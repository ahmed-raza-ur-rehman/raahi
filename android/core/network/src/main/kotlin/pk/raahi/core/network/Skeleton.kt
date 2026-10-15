package pk.raahi.core.network

import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import pk.raahi.core.model.Ping

private val json = Json { ignoreUnknownKeys = true }

fun fetchPing(client: OkHttpClient, url: String): Ping =
    client.newCall(Request.Builder().url(url).build()).execute().use { response ->
        json.decodeFromString(Ping.serializer(), response.body.string())
    }
