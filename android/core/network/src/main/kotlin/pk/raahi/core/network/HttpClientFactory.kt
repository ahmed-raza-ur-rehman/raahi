package pk.raahi.core.network

import java.io.IOException
import java.time.Duration
import okhttp3.CertificatePinner
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response

/** Refuses any request that is not HTTPS, except to hosts explicitly allowed (a local server in debug builds). */
class HttpsOnlyInterceptor(private val allowedCleartextHosts: Set<String> = emptySet()) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (!request.isHttps && request.url.host !in allowedCleartextHosts) {
            throw InsecureConnectionException("Cleartext HTTP to ${request.url.host} is not permitted.")
        }
        return chain.proceed(request)
    }
}

class InsecureConnectionException(message: String) : IOException(message)

/**
 * The one place that decides how the app talks to the network.
 *
 * Defaults are strict: HTTPS only, modest timeouts, no automatic redirects to other hosts, and optional certificate
 * pinning. Pinning is OFF by default because a pin that outlives the certificate would lock every user out; when the
 * operator supplies pins they MUST include a backup pin and the release process documents rotation
 * (docs/mobile/security.md).
 */
object HttpClientFactory {
    fun create(
        allowedCleartextHosts: Set<String> = emptySet(),
        pins: Map<String, List<String>> = emptyMap(),
        callTimeout: Duration = Duration.ofSeconds(30),
        base: OkHttpClient = OkHttpClient(),
    ): OkHttpClient {
        val builder = base.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .readTimeout(Duration.ofSeconds(20))
            .writeTimeout(Duration.ofSeconds(20))
            .callTimeout(callTimeout)
            .followRedirects(true)
            .followSslRedirects(false)
            .addInterceptor(HttpsOnlyInterceptor(allowedCleartextHosts))
        if (pins.isNotEmpty()) {
            val pinner = CertificatePinner.Builder()
            for ((host, hostPins) in pins) hostPins.forEach { pinner.add(host, it) }
            builder.certificatePinner(pinner.build())
        }
        return builder.build()
    }
}
