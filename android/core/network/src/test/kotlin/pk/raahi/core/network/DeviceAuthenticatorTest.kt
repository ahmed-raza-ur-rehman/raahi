package pk.raahi.core.network

import java.time.Duration
import java.time.Instant
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest

class DeviceAuthenticatorTest {
    private var clock: Instant = Instant.parse("2026-10-15T08:00:00Z")
    private val challenges = AtomicInteger()
    private val registrations = AtomicInteger()
    private var challengeResult: ApiResult<ChallengeDto> = ApiResult.Success(ChallengeDto("payload.sig", "sha256-leading-zero-bits", 8, "2026-10-15T08:05:00Z"))

    private val auth = object : AuthApi {
        override suspend fun challenge(): ApiResult<ChallengeDto> {
            challenges.incrementAndGet()
            delay(10)
            return challengeResult
        }

        override suspend fun register(request: DeviceRequestDto): ApiResult<DeviceResponseDto> {
            registrations.incrementAndGet()
            return ApiResult.Success(DeviceResponseDto("token-${registrations.get()}", "Bearer", 3600, "read tools assistant"))
        }
    }

    private fun authenticator(solve: suspend (String) -> String = { "7" }) = DeviceAuthenticator(auth, { "3f1c2b5e-8d6a-4f0e-9b21-0a7c5d4e6f10" }, { clock }, solve)

    @Test
    fun `[REQ-AND-003] the first call registers; later calls reuse the cached token`() = runTest {
        val sut = authenticator()
        assertNull(sut.cached())
        assertEquals("token-1", sut.token())
        assertEquals("token-1", sut.cached())
        assertEquals("token-1", sut.token())
        assertEquals(1, registrations.get())
    }

    @Test
    fun `[REQ-AND-003] ten screens asking at once cause one registration (single flight)`() = runTest {
        val sut = authenticator()
        val tokens = (1..10).map { async { sut.token() } }.awaitAll()
        assertEquals(setOf("token-1"), tokens.toSet())
        assertEquals(1, challenges.get())
        assertEquals(1, registrations.get())
    }

    @Test
    fun `[REQ-AND-003] the token is renewed shortly before it expires, not after`() = runTest {
        val sut = authenticator()
        sut.token()
        clock = clock.plus(Duration.ofMinutes(57))
        assertNotNull(sut.cached(), "still valid with the refresh margin to spare")
        clock = clock.plus(Duration.ofMinutes(2))
        assertNull(sut.cached(), "inside the refresh margin the cached token is no longer offered")
        assertEquals("token-2", sut.token())
    }

    @Test
    fun `[REQ-AND-003] forcing a refresh registers again`() = runTest {
        val sut = authenticator()
        sut.token()
        assertEquals("token-2", sut.token(forceRefresh = true))
        sut.invalidate()
        assertNull(sut.cached())
    }

    @Test
    fun `[REQ-AND-003] a server with registration switched off puts the app in anonymous mode without hammering it`() = runTest {
        challengeResult = ApiResult.Failure(ApiError.Server(503, ProblemDto("t", "t", 503, "not_configured")))
        val sut = authenticator()
        assertNull(sut.token())
        assertNull(sut.token())
        assertNull(sut.token())
        assertEquals(1, challenges.get(), "the unavailable answer is remembered")
        clock = clock.plus(Duration.ofMinutes(11))
        challengeResult = ApiResult.Success(ChallengeDto("payload.sig", "sha256-leading-zero-bits", 8, "x"))
        assertEquals("token-1", sut.token(), "after the back-off the app tries again")
    }

    @Test
    fun `[REQ-AND-003] an unsolvable challenge or a network failure yields no token instead of an exception`() = runTest {
        assertNull(authenticator(solve = { throw ProofOfWorkException("too hard") }).token())
        challengeResult = ApiResult.Failure(ApiError.Offline)
        assertNull(authenticator().token())
    }
}
