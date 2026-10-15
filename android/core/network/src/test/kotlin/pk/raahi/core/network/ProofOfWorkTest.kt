package pk.raahi.core.network

import java.util.Base64
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import pk.raahi.core.testing.Fixtures

class ProofOfWorkTest {
    private fun challengeOf(salt: String, difficulty: Int): String {
        val payload = """{"v":1,"s":"$salt","d":$difficulty,"e":1800000300,"k":"k1"}"""
        return Base64.getUrlEncoder().withoutPadding().encodeToString(payload.toByteArray()) + ".c2lnbmF0dXJl"
    }

    @Test
    fun `REQ-AND-003 the solver finds exactly the nonce the server's reference solver finds`() {
        val vectors = Json.parseToJsonElement(Fixtures.text("vectors/pow.json")).jsonObject.getValue("vectors").jsonArray
        assertTrue(vectors.size >= 12)
        for (vector in vectors) {
            val v = vector.jsonObject
            val salt = v.getValue("salt").jsonPrimitive.content
            val difficulty = v.getValue("difficulty").jsonPrimitive.int
            val expected = v.getValue("nonce").jsonPrimitive.content.toLong()
            assertEquals(expected, ProofOfWork.findNonce(salt, difficulty), "salt=$salt difficulty=$difficulty")
            assertEquals(v.getValue("digestHex").jsonPrimitive.content, ProofOfWork.digest(salt, expected).joinToString("") { "%02x".format(it) })
        }
    }

    @Test
    fun `REQ-AND-003 leading zero bits are counted bit by bit`() {
        val cases = Json.parseToJsonElement(Fixtures.text("vectors/pow.json")).jsonObject.getValue("bits").jsonArray
        for (case in cases) {
            val hex = case.jsonObject.getValue("hex").jsonPrimitive.content
            val bytes = hex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
            assertEquals(case.jsonObject.getValue("bits").jsonPrimitive.int, ProofOfWork.leadingZeroBits(bytes), hex)
        }
    }

    @Test
    fun `REQ-AND-003 a real challenge string is parsed and solved end to end`() = runBlocking {
        val challenge = challengeOf("AAAAAAAAAAAAAAAAAAAAAA", 10)
        val parsed = assertNotNull(ProofOfWork.parse(challenge))
        assertEquals("AAAAAAAAAAAAAAAAAAAAAA", parsed.salt)
        assertEquals(10, parsed.difficulty)
        val nonce = ProofOfWork.solve(challenge)
        assertTrue(ProofOfWork.leadingZeroBits(ProofOfWork.digest(parsed.salt, nonce.toLong())) >= 10)
    }

    @Test
    fun `REQ-AND-003 malformed challenges are rejected rather than guessed at`() {
        for (bad in listOf("", "no-dot", ".", "!!!.sig", challengeOf("short", 8), challengeOf("AAAAAAAAAAAAAAAA", 0), challengeOf("AAAAAAAAAAAAAAAA", 40), "x".repeat(500) + ".sig")) {
            assertNull(ProofOfWork.parse(bad), bad.take(40))
        }
    }

    @Test
    fun `REQ-AND-003 a hostile server cannot make the phone burn its battery`() = runBlocking {
        val tooHard = challengeOf("AAAAAAAAAAAAAAAA", 30)
        assertFailsWith<ProofOfWorkException> { ProofOfWork.solve(tooHard) }
    }

    @Test
    fun `REQ-AND-003 cancelling the coroutine stops the search promptly`() = runBlocking {
        val job = async(start = CoroutineStart.DEFAULT) { runCatching { ProofOfWork.solve(challengeOf("AAAAAAAAAAAAAAAA", 24)) } }
        Thread.sleep(100)
        val started = System.nanoTime()
        job.cancelAndJoin()
        assertTrue((System.nanoTime() - started) / 1_000_000 < 2_000, "cancellation must not wait for the search to finish")
    }

    @Test
    fun `REQ-AND-003 the search gives up at its iteration budget instead of running forever`() {
        assertNull(ProofOfWork.findNonce("AAAAAAAAAAAAAAAA", 30, maxIterations = 5_000))
    }
}
