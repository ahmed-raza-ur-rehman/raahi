package pk.raahi.core.network

import java.security.MessageDigest
import java.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class ProofOfWorkException(message: String) : Exception(message)

/**
 * Client side of the server's anonymous-registration challenge (docs/api/authentication.md): find the smallest
 * integer `nonce` such that SHA-256("<salt>:<nonce>") has at least `difficulty` leading zero bits.
 *
 * Parity with the server's reference solver is verified against `contract/v1/vectors/pow.json`.
 */
object ProofOfWork {
    class Challenge(val salt: String, val difficulty: Int)

    /** A phone must not be made to burn its battery by a hostile or buggy server. */
    const val MAX_ACCEPTED_DIFFICULTY = 24

    /** Reads the salt and difficulty from the challenge payload (the signature is for the server to check). */
    fun parse(challenge: String): Challenge? {
        val payload = challenge.substringBefore('.', missingDelimiterValue = "")
        if (payload.isEmpty() || payload.length > 400) return null
        return try {
            val text = String(Base64.getUrlDecoder().decode(payload), Charsets.UTF_8)
            val obj = ApiJson.parseToJsonElement(text).jsonObject
            val salt = obj["s"]?.jsonPrimitive?.contentOrNull ?: return null
            val difficulty = obj["d"]?.jsonPrimitive?.intOrNull ?: return null
            if (salt.length !in 8..64 || difficulty !in 1..32) null else Challenge(salt, difficulty)
        } catch (_: IllegalArgumentException) {
            null
        } catch (_: SerializationException) {
            null
        }
    }

    fun leadingZeroBits(digest: ByteArray): Int {
        var bits = 0
        for (byte in digest) {
            val value = byte.toInt() and 0xFF
            if (value == 0) {
                bits += 8
                continue
            }
            bits += Integer.numberOfLeadingZeros(value) - 24
            break
        }
        return bits
    }

    fun digest(salt: String, nonce: Long): ByteArray = MessageDigest.getInstance("SHA-256").digest("$salt:$nonce".toByteArray(Charsets.UTF_8))

    /** The smallest qualifying nonce, or null if none was found within the budget or [shouldContinue] turned false. */
    fun findNonce(salt: String, difficulty: Int, maxIterations: Long = 100_000_000L, shouldContinue: () -> Boolean = { true }): Long? {
        val sha = MessageDigest.getInstance("SHA-256")
        val prefix = "$salt:".toByteArray(Charsets.UTF_8)
        var nonce = 0L
        while (nonce < maxIterations) {
            if (nonce and 0xFFFL == 0L && !shouldContinue()) return null
            sha.update(prefix)
            sha.update(nonce.toString().toByteArray(Charsets.US_ASCII))
            if (leadingZeroBits(sha.digest()) >= difficulty) return nonce
            nonce += 1
        }
        return null
    }

    /** Solve off the main thread; cancelling the coroutine stops the search within a few thousand hashes. */
    suspend fun solve(challenge: String, maxDifficulty: Int = MAX_ACCEPTED_DIFFICULTY): String {
        val parsed = parse(challenge) ?: throw ProofOfWorkException("The challenge is malformed.")
        if (parsed.difficulty > maxDifficulty) throw ProofOfWorkException("The challenge is harder than this app will attempt (${parsed.difficulty} bits).")
        return withContext(Dispatchers.Default) {
            val nonce = findNonce(parsed.salt, parsed.difficulty) { isActive } ?: throw ProofOfWorkException("No solution was found.")
            nonce.toString()
        }
    }
}
