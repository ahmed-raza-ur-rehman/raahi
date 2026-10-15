package pk.raahi.core.network

import java.time.Duration
import java.util.concurrent.atomic.AtomicInteger
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import pk.raahi.core.testing.Fixtures

class RaahiApiTest {
    private val fastRetry = RetryPolicy(maxAttempts = 3, baseDelayMs = 1, maxDelayMs = 2, random = Random(1))

    private fun json(body: String, code: Int = 200, vararg headers: Pair<String, String>) =
        MockResponse.Builder().code(code).body(body).addHeader("Content-Type", "application/json").apply { headers.forEach { (k, v) -> addHeader(k, v) } }.build()

    private fun problem(name: String, code: Int, vararg headers: Pair<String, String>) =
        MockResponse.Builder().code(code).body(Fixtures.text(name)).addHeader("Content-Type", "application/problem+json").apply { headers.forEach { (k, v) -> addHeader(k, v) } }.build()

    private fun withApi(
        tokens: TokenProvider? = null,
        retry: RetryPolicy = fastRetry,
        client: (MockWebServer) -> OkHttpClient = { server -> HttpClientFactory.create(allowedCleartextHosts = setOf(server.hostName)) },
        block: suspend (RaahiApi, MockWebServer) -> Unit,
    ) = runTest {
        MockWebServer().use { server ->
            server.start()
            var counter = 0
            val transport = ApiTransport(server.url("/"), client(server), "RAAHI-Android/1.0.0 (test)", retry, newRequestId = { "req-${++counter}" })
            block(DefaultRaahiApi(transport, tokens), server)
        }
    }

    @Test
    fun `REQ-AND-002 the manifest is fetched conditionally and 304 means nothing changed`() = withApi { api, server ->
        server.enqueue(json(Fixtures.text("sync/manifest.v1.json"), 200, "ETag" to "W/\"abc\""))
        server.enqueue(MockResponse.Builder().code(304).addHeader("ETag", "W/\"abc\"").build())

        val first = assertIs<ApiResult.Success<ManifestResponseDto>>(api.manifest(null))
        assertEquals("W/\"abc\"", first.etag)
        assertEquals(12, first.value.data.size)
        assertEquals(ApiResult.NotModified, api.manifest(first.etag))

        val firstRequest = server.takeRequest()
        val secondRequest = server.takeRequest()
        assertNull(firstRequest.headers["If-None-Match"])
        assertEquals("W/\"abc\"", secondRequest.headers["If-None-Match"])
        assertEquals("/api/v1/opportunities/manifest", secondRequest.url.encodedPath)
    }

    @Test
    fun `REQ-API-001 every request identifies the app, asks for JSON and carries a distinct request id`() = withApi { api, server ->
        repeat(2) { server.enqueue(json(Fixtures.text("guides.list.json"))) }
        api.guides("en")
        api.guides("ur")
        val a = server.takeRequest()
        val b = server.takeRequest()
        assertEquals("RAAHI-Android/1.0.0 (test)", a.headers["User-Agent"])
        assertEquals("application/json", a.headers["Accept"])
        assertNotEquals(a.headers["X-Request-Id"], b.headers["X-Request-Id"])
        assertNull(a.headers["Authorization"], "no credential is sent when the app has none")
        assertEquals("en", a.url.queryParameter("lang"))
        assertEquals("ur", b.url.queryParameter("lang"))
    }

    @Test
    fun `REQ-AND-003 a cached token is attached to reads so limits are per install, not per shared address`() {
        val provider = object : TokenProvider {
            override fun cached() = "tok-123"
            override suspend fun token(forceRefresh: Boolean) = "tok-123"
        }
        withApi(provider) { api, server ->
            server.enqueue(json(Fixtures.text("guides.list.json")))
            api.guides("en")
            assertEquals("Bearer tok-123", server.takeRequest().headers["Authorization"])
        }
    }

    @Test
    fun `REQ-AND-002 batch requests carry their ids and enforce the server's cap on the client`() = withApi { api, server ->
        server.enqueue(json(Fixtures.text("sync/items.v1.json").let { """{"data":$it,"missing":[],"meta":{"generatedAt":null,"dataVersion":"abcdefabcdef"}}""" }))
        val result = api.batch(listOf("a-0123456789", "b-0123456789"))
        assertIs<ApiResult.Success<BatchResponseDto>>(result)
        assertEquals("a-0123456789,b-0123456789", server.takeRequest().url.queryParameter("ids"))
        val rejected = runCatching { api.batch(List(51) { "id-$it-0123456789" }) }
        assertTrue(rejected.exceptionOrNull() is IllegalArgumentException)
    }

    @Test
    fun `REQ-AND-004 a 429 is retried after the time the server asks for, then reported with it`() = withApi(retry = fastRetry.copy(maxAttempts = 2)) { api, server ->
        server.enqueue(problem("problems.unknown-parameter.json", 429, "Retry-After" to "0"))
        server.enqueue(problem("problems.unknown-parameter.json", 429, "Retry-After" to "2"))
        val result = api.guides("en")
        val failure = assertIs<ApiResult.Failure>(result)
        assertEquals(ApiError.RateLimited(2), failure.error)
        assertEquals(2, server.requestCount)
    }

    @Test
    fun `REQ-AND-004 a transient 503 is retried and the request then succeeds`() = withApi { api, server ->
        server.enqueue(MockResponse.Builder().code(503).body("{}").build())
        server.enqueue(json(Fixtures.text("guides.list.json")))
        assertIs<ApiResult.Success<GuideListDto>>(api.guides("en"))
        assertEquals(2, server.requestCount)
    }

    @Test
    fun `REQ-AND-004 a persistent 500 gives up after the attempt budget and reports a server error`() = withApi { api, server ->
        repeat(5) { server.enqueue(MockResponse.Builder().code(500).body("{}").build()) }
        val failure = assertIs<ApiResult.Failure>(api.guides("en"))
        assertEquals(ApiError.Server(500), failure.error)
        assertEquals(3, server.requestCount, "exactly maxAttempts requests")
    }

    @Test
    fun `REQ-AND-004 contract errors are not retried`() = withApi { api, server ->
        server.enqueue(MockResponse.Builder().code(404).body("{}").build())
        assertEquals(ApiError.NotFound, assertIs<ApiResult.Failure>(api.guides("en")).error)
        assertEquals(1, server.requestCount)
        server.enqueue(problem("problems.unknown-parameter.json", 400))
        val client = assertIs<ApiError.Client>(assertIs<ApiResult.Failure>(api.guides("en")).error)
        assertEquals(400, client.status)
        assertEquals("unknown_parameter", client.problem?.code)
        assertEquals(2, server.requestCount)
    }

    @Test
    fun `REQ-AND-004 undecodable and oversized bodies are reported as malformed, never crash`() = withApi { api, server ->
        server.enqueue(json("{not json"))
        assertIs<ApiError.Malformed>(assertIs<ApiResult.Failure>(api.guides("en")).error)
        server.enqueue(json("""{"unexpected":true}"""))
        assertIs<ApiError.Malformed>(assertIs<ApiResult.Failure>(api.guides("en")).error)
        server.enqueue(json("x".repeat(7 * 1024 * 1024)))
        val oversized = assertIs<ApiError.Malformed>(assertIs<ApiResult.Failure>(api.guides("en")).error)
        assertTrue(oversized.reason.contains("larger"))
    }

    @Test
    fun `REQ-AND-004 a server that never answers becomes a timeout`() {
        val impatient = { server: MockWebServer -> HttpClientFactory.create(allowedCleartextHosts = setOf(server.hostName)).newBuilder().readTimeout(Duration.ofMillis(150)).build() }
        withApi(retry = fastRetry.copy(maxAttempts = 1), client = impatient) { api, server ->
            server.enqueue(MockResponse.Builder().headersDelay(5, java.util.concurrent.TimeUnit.SECONDS).build())
            assertEquals(ApiError.Timeout, assertIs<ApiResult.Failure>(api.guides("en")).error)
        }
    }

    @Test
    fun `REQ-AND-004 cleartext HTTP is refused unless the host is explicitly allowed`() {
        withApi(client = { HttpClientFactory.create() }) { api, server ->
            server.enqueue(json(Fixtures.text("guides.list.json")))
            val failure = assertIs<ApiResult.Failure>(api.guides("en"))
            assertIs<ApiError.Insecure>(failure.error)
            assertEquals(0, server.requestCount, "no byte may reach the server over cleartext")
        }
    }

    @Test
    fun `REQ-AND-004 a TLS handshake failure is an insecure-connection error and is never retried`() = runTest {
        // MockWebServer speaks plain HTTP; an https:// request to it fails the handshake.
        MockWebServer().use { server ->
            server.start()
            val tlsUrl = server.url("/").newBuilder().scheme("https").build()
            val attempts = AtomicInteger()
            val transport = ApiTransport(tlsUrl, HttpClientFactory.create(), "test", fastRetry, newRequestId = { "r${attempts.incrementAndGet()}" })
            val failure = assertIs<ApiResult.Failure>(DefaultRaahiApi(transport).guides("en"))
            assertIs<ApiError.Insecure>(failure.error)
            assertEquals(1, attempts.get(), "TLS failures are not retried")
        }
    }

    @Test
    fun `REQ-AND-003 the scam check refreshes an expired token once and then succeeds`() {
        val issued = AtomicInteger()
        val provider = object : TokenProvider {
            override fun cached() = null
            override suspend fun token(forceRefresh: Boolean) = "token-${issued.incrementAndGet()}"
        }
        withApi(provider) { api, server ->
            server.enqueue(problem("problems.token-expired.json", 401))
            server.enqueue(json(Json.parseToJsonElement(Fixtures.text("tools.scam-check.json")).jsonObject.getValue("response").toString()))
            val result = api.scamCheck(ScamRequestDto(text = "pay advance fee for visa"))
            assertIs<ApiResult.Success<ScamResponseDto>>(result)
            assertEquals("Bearer token-1", server.takeRequest().headers["Authorization"])
            assertEquals("Bearer token-2", server.takeRequest().headers["Authorization"])
            assertEquals(2, server.requestCount, "exactly one refresh, no loop")
        }
    }

    @Test
    fun `REQ-AND-003 the scam check without any token fails as unauthorised without touching the network`() = withApi(tokens = null) { api, server ->
        assertEquals(ApiError.Unauthorized(false), assertIs<ApiResult.Failure>(api.scamCheck(ScamRequestDto(text = "x"))).error)
        assertEquals(0, server.requestCount)
    }

    @Test
    fun `REQ-AND-004 request bodies omit absent fields (the server's schemas are strict)`() = withApi(object : TokenProvider {
        override fun cached() = "t"
        override suspend fun token(forceRefresh: Boolean) = "t"
    }) { api, server ->
        server.enqueue(MockResponse.Builder().code(500).body("{}").build())
        api.scamCheck(ScamRequestDto(text = "hello"))
        val body = server.takeRequest().body!!.utf8()
        assertEquals("""{"text":"hello"}""", body)
    }

}
