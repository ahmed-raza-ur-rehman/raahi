package pk.raahi.core.network

import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import kotlin.test.Test
import kotlin.test.assertTrue

class SkeletonTest {
    @Test
    fun readsPingFromServer() {
        MockWebServer().use { server ->
            server.enqueue(MockResponse.Builder().code(200).body("""{"ok":true,"extra":1}""").build())
            server.start()
            assertTrue(fetchPing(OkHttpClient(), server.url("/ping").toString()).ok)
        }
    }
}
