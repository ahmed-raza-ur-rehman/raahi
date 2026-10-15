package pk.raahi.core.network

/** Everything that can go wrong talking to the server, as data the UI can act on (no exceptions cross this boundary). */
sealed interface ApiError {
    /** No connection (no route, DNS failure, refused). */
    data object Offline : ApiError

    data object Timeout : ApiError

    /** 429. The server says when to come back. */
    data class RateLimited(val retryAfterSeconds: Int?) : ApiError

    /** 401. `expired` = the access token ran out (register again), otherwise the credential is wrong. */
    data class Unauthorized(val expired: Boolean) : ApiError

    data object Forbidden : ApiError

    data object NotFound : ApiError

    /** Any other 4xx: a bug in the app or a changed contract. */
    data class Client(val status: Int, val problem: ProblemDto?) : ApiError

    data class Server(val status: Int, val problem: ProblemDto? = null) : ApiError

    /** The body could not be read as the expected contract (or was absurdly large). */
    data class Malformed(val reason: String) : ApiError

    /** TLS failure, certificate-pin mismatch or a cleartext attempt. Never retried and never silently downgraded. */
    data class Insecure(val reason: String) : ApiError
}

sealed interface ApiResult<out T> {
    data class Success<T>(val value: T, val etag: String? = null) : ApiResult<T>

    /** 304: what the caller already has is current. */
    data object NotModified : ApiResult<Nothing>

    data class Failure(val error: ApiError) : ApiResult<Nothing>
}

inline fun <T, R> ApiResult<T>.map(transform: (T) -> R): ApiResult<R> = when (this) {
    is ApiResult.Success -> ApiResult.Success(transform(value), etag)
    ApiResult.NotModified -> ApiResult.NotModified
    is ApiResult.Failure -> this
}

fun <T> ApiResult<T>.valueOrNull(): T? = (this as? ApiResult.Success)?.value
