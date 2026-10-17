package pk.raahi.core.network

import java.time.Duration
import java.time.Instant
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Supplies the short-lived access token for the endpoints that need one. */
interface TokenProvider {
    /** A still-valid token without any network call, or null. */
    fun cached(): String?

    /** A valid token, registering the device first when needed. Null when registration is unavailable or failed. */
    suspend fun token(forceRefresh: Boolean = false): String?
}

interface AuthApi {
    suspend fun challenge(): ApiResult<ChallengeDto>

    suspend fun register(request: DeviceRequestDto): ApiResult<DeviceResponseDto>
}

/**
 * Anonymous device registration: ask for a proof-of-work challenge, solve it, exchange the solution for a token that
 * lasts about an hour. There is no refresh token on the device - when the token expires the app simply registers again,
 * so no long-lived credential exists to steal.
 *
 *  - Single flight: ten screens asking at once cause ONE registration (a mutex), not ten.
 *  - A server that has registration switched off (503 `not_configured`) is remembered for a while, so the app runs in
 *    anonymous mode without hammering it.
 */
class DeviceAuthenticator(
    private val auth: AuthApi,
    private val installId: suspend () -> String,
    private val now: () -> Instant = Instant::now,
    private val solve: suspend (String) -> String = { ProofOfWork.solve(it) },
    private val platform: String = "android",
    private val refreshSkew: Duration = Duration.ofMinutes(2),
    private val unavailableBackoff: Duration = Duration.ofMinutes(10),
) : TokenProvider {
    private data class Cached(val token: String, val expiresAt: Instant)

    private val mutex = Mutex()

    @Volatile
    private var current: Cached? = null

    @Volatile
    private var unavailableUntil: Instant = Instant.MIN

    override fun cached(): String? = current?.takeIf { now().isBefore(it.expiresAt.minus(refreshSkew)) }?.token

    override suspend fun token(forceRefresh: Boolean): String? = mutex.withLock {
        if (!forceRefresh) cached()?.let { return@withLock it }
        if (now().isBefore(unavailableUntil)) return@withLock null

        val challenge = when (val result = auth.challenge()) {
            is ApiResult.Success -> result.value
            is ApiResult.Failure -> {
                if (result.error.isNotConfigured()) unavailableUntil = now().plus(unavailableBackoff)
                return@withLock null
            }
            ApiResult.NotModified -> return@withLock null
        }
        val nonce = try {
            solve(challenge.challenge)
        } catch (_: ProofOfWorkException) {
            return@withLock null
        }
        val registered = auth.register(DeviceRequestDto(challenge.challenge, nonce, installId(), platform))
        val issued = (registered as? ApiResult.Success)?.value ?: return@withLock null
        current = Cached(issued.accessToken, now().plusSeconds(issued.expiresIn.toLong()))
        issued.accessToken
    }

    /** Forget the token (the server said it is no longer valid). */
    fun invalidate() {
        current = null
    }

    private fun ApiError.isNotConfigured() = this is ApiError.Server && status == 503 && problem?.code == "not_configured"
}
