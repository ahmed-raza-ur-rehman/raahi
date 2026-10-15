package pk.raahi.core.model

import kotlinx.serialization.Serializable

@Serializable
data class Ping(val ok: Boolean)

fun ping(): Ping = Ping(ok = true)
