package pk.raahi.core.network

import java.io.IOException
import java.io.InterruptedIOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.UUID
import javax.net.ssl.SSLException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response

/**
 * HTTP plumbing shared by every endpoint: builds requests, maps the outcome to [ApiResult], and enforces the rules
 * that must hold for every call - a bounded response size, a tolerant JSON reader, identifying headers, no leaking of
 * exceptions to callers and no retry of TLS failures.
 */
class ApiTransport(
    private val baseUrl: HttpUrl,
    private val client: OkHttpClient,
    private val userAgent: String,
    private val retry: RetryPolicy = RetryPolicy(),
    private val json: Json = ApiJson,
    private val newRequestId: () -> String = { UUID.randomUUID().toString() },
    private val maxBodyBytes: Long = MAX_BODY_BYTES,
) {
    suspend fun <T> get(path: String, query: List<Pair<String, String>> = emptyList(), serializer: KSerializer<T>, etag: String? = null, token: String? = null): ApiResult<T> =
        retry.execute { call(buildGet(path, query, etag, token), serializer) }

    suspend fun <B, T> post(path: String, body: B, bodySerializer: KSerializer<B>, serializer: KSerializer<T>, token: String? = null): ApiResult<T> {
        val payload = json.encodeToString(bodySerializer, body)
        // POSTs are not idempotent in general, so there is no automatic retry here; the caller decides.
        return call(buildPost(path, payload, token), serializer)
    }

    private fun url(path: String, query: List<Pair<String, String>>): HttpUrl = baseUrl.newBuilder().addPathSegments(path.trimStart('/')).apply { query.forEach { (key, value) -> addQueryParameter(key, value) } }.build()

    private fun common(builder: Request.Builder, token: String?): Request.Builder = builder
        .header("User-Agent", userAgent)
        .header("Accept", "application/json")
        .header("X-Request-Id", newRequestId())
        .apply { if (token != null) header("Authorization", "Bearer $token") }

    private fun buildGet(path: String, query: List<Pair<String, String>>, etag: String?, token: String?): Request =
        common(Request.Builder().url(url(path, query)).get(), token).apply { if (etag != null) header("If-None-Match", etag) }.build()

    private fun buildPost(path: String, payload: String, token: String?): Request =
        common(Request.Builder().url(url(path, emptyList())).post(payload.toRequestBody(JSON_TYPE)), token).build()

    private suspend fun <T> call(request: Request, serializer: KSerializer<T>): ApiResult<T> {
        val response = try {
            client.newCall(request).await()
        } catch (e: InsecureConnectionException) {
            return ApiResult.Failure(ApiError.Insecure(e.message ?: "insecure connection"))
        } catch (e: SSLException) {
            return ApiResult.Failure(ApiError.Insecure("TLS failure: ${e.javaClass.simpleName}"))
        } catch (_: SocketTimeoutException) {
            return ApiResult.Failure(ApiError.Timeout)
        } catch (e: InterruptedIOException) {
            return ApiResult.Failure(if (e.message?.contains("timeout", ignoreCase = true) == true) ApiError.Timeout else ApiError.Offline)
        } catch (_: UnknownHostException) {
            return ApiResult.Failure(ApiError.Offline)
        } catch (_: ConnectException) {
            return ApiResult.Failure(ApiError.Offline)
        } catch (_: IOException) {
            return ApiResult.Failure(ApiError.Offline)
        }
        return response.use { interpret(it, serializer) }
    }

    private fun <T> interpret(response: Response, serializer: KSerializer<T>): ApiResult<T> {
        val code = response.code
        if (code == 304) return ApiResult.NotModified
        val body = readBounded(response) ?: return ApiResult.Failure(ApiError.Malformed("The response was larger than ${maxBodyBytes / 1024} KiB."))
        if (code in 200..299) {
            return try {
                ApiResult.Success(json.decodeFromString(serializer, body), response.header("ETag"))
            } catch (e: SerializationException) {
                ApiResult.Failure(ApiError.Malformed(e.message?.take(160) ?: "undecodable body"))
            } catch (e: IllegalArgumentException) {
                ApiResult.Failure(ApiError.Malformed(e.message?.take(160) ?: "undecodable body"))
            }
        }
        val problem = runCatching { json.decodeFromString(ProblemDto.serializer(), body) }.getOrNull()
        return ApiResult.Failure(
            when (code) {
                401 -> ApiError.Unauthorized(expired = problem?.code == "token_expired")
                403 -> ApiError.Forbidden
                404 -> ApiError.NotFound
                429 -> ApiError.RateLimited(response.header("Retry-After")?.trim()?.toIntOrNull()?.coerceIn(0, 3600))
                in 500..599 -> ApiError.Server(code, problem)
                else -> ApiError.Client(code, problem)
            },
        )
    }

    private fun readBounded(response: Response): String? {
        val source = response.body.source()
        source.request(maxBodyBytes + 1)
        if (source.buffer.size > maxBodyBytes) return null
        return source.buffer.readUtf8()
    }

    private suspend fun Call.await(): Response = suspendCancellableCoroutine { continuation ->
        continuation.invokeOnCancellation { cancel() }
        enqueue(
            object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    if (continuation.isActive) continuation.resumeWithException(e)
                }

                override fun onResponse(call: Call, response: Response) {
                    if (continuation.isActive) continuation.resume(response) else response.close()
                }
            },
        )
    }

    companion object {
        const val MAX_BODY_BYTES: Long = 6L * 1024 * 1024
        private val JSON_TYPE = "application/json".toMediaType()
    }
}
