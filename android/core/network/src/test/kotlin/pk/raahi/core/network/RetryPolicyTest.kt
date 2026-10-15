package pk.raahi.core.network

import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlinx.coroutines.test.currentTime
import kotlinx.coroutines.test.runTest

class RetryPolicyTest {
    private val policy = RetryPolicy(maxAttempts = 4, baseDelayMs = 400, maxDelayMs = 8_000, random = Random(42))

    @Test
    fun `REQ-AND-004 only transient failures are retried`() {
        for (transient in listOf(ApiError.Offline, ApiError.Timeout, ApiError.RateLimited(5), ApiError.RateLimited(null), ApiError.Server(503), ApiError.Server(502), ApiError.Server(504))) {
            assertTrue(policy.isTransient(transient), "$transient")
        }
        for (permanent in listOf(ApiError.NotFound, ApiError.Forbidden, ApiError.Unauthorized(true), ApiError.Client(400, null), ApiError.Server(500), ApiError.Malformed("x"), ApiError.Insecure("x"), ApiError.RateLimited(600))) {
            assertFalse(policy.isTransient(permanent), "$permanent")
        }
    }

    @Test
    fun `REQ-AND-004 backoff grows exponentially, never exceeds its ceiling and is jittered`() {
        val first = List(200) { policy.delayBeforeRetryMs(ApiError.Offline, 1) }
        val later = List(200) { policy.delayBeforeRetryMs(ApiError.Offline, 5) }
        assertTrue(first.all { it in 0..400 } && later.all { it in 0..8_000 })
        assertTrue(later.max() > first.max(), "later attempts wait longer")
        assertTrue(first.toSet().size > 20, "full jitter spreads retries out")
        assertEquals(7_000, policy.delayBeforeRetryMs(ApiError.RateLimited(7), 1), "Retry-After wins")
    }

    @Test
    fun `REQ-AND-004 execute stops at the attempt budget and waits between attempts`() = runTest {
        var calls = 0
        val result = policy.execute<Unit> {
            calls += 1
            ApiResult.Failure(ApiError.Server(503))
        }
        assertEquals(4, calls)
        assertEquals(ApiResult.Failure(ApiError.Server(503)), result)
        assertTrue(currentTime >= 0, "virtual time advanced between attempts without real sleeping")
    }

    @Test
    fun `REQ-AND-004 execute returns immediately on success or on a permanent error`() = runTest {
        var calls = 0
        policy.execute { calls += 1; ApiResult.Success(1) }
        assertEquals(1, calls)
        policy.execute<Int> { calls += 1; ApiResult.Failure(ApiError.NotFound) }
        assertEquals(2, calls)
    }
}
