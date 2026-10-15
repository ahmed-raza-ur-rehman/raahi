package pk.raahi.core.network

import kotlin.random.Random
import kotlinx.coroutines.delay

/**
 * Retries for idempotent reads: exponential backoff with FULL jitter (so thousands of phones that failed together do
 * not retry together), and the server's `Retry-After` honoured when it sends one. Only transient failures are retried:
 * offline, timeouts, 429 and 502/503/504. TLS problems, 4xx contract errors and malformed bodies are not.
 */
data class RetryPolicy(
    val maxAttempts: Int = 3,
    val baseDelayMs: Long = 400,
    val maxDelayMs: Long = 8_000,
    val maxRetryAfterSeconds: Int = 30,
    val random: Random = Random.Default,
) {
    init {
        require(maxAttempts >= 1) { "maxAttempts must be at least 1" }
    }

    fun isTransient(error: ApiError): Boolean = when (error) {
        ApiError.Offline, ApiError.Timeout -> true
        is ApiError.RateLimited -> (error.retryAfterSeconds ?: 1) <= maxRetryAfterSeconds
        is ApiError.Server -> error.status in setOf(502, 503, 504)
        else -> false
    }

    fun delayBeforeRetryMs(error: ApiError, attempt: Int): Long {
        if (error is ApiError.RateLimited && error.retryAfterSeconds != null) return error.retryAfterSeconds * 1_000L
        val ceiling = minOf(maxDelayMs, baseDelayMs shl minOf(attempt - 1, 10))
        return random.nextLong(0, ceiling + 1)
    }
}

suspend fun <T> RetryPolicy.execute(block: suspend () -> ApiResult<T>): ApiResult<T> {
    var attempt = 1
    while (true) {
        val result = block()
        if (result !is ApiResult.Failure || attempt >= maxAttempts || !isTransient(result.error)) return result
        delay(delayBeforeRetryMs(result.error, attempt))
        attempt += 1
    }
}
