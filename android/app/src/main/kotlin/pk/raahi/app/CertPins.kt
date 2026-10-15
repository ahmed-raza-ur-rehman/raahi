package pk.raahi.app

/**
 * Parses the optional certificate-pin configuration: `host=sha256/AAAA|sha256/BBBB;other.host=sha256/CCCC`.
 * Malformed entries are dropped rather than half-applied. An empty string means "no pinning" (the default).
 */
object CertPins {
    private val pin = Regex("^sha256/[A-Za-z0-9+/]{43}=$")
    private val host = Regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$")

    fun parse(text: String): Map<String, List<String>> {
        if (text.isBlank()) return emptyMap()
        val out = linkedMapOf<String, List<String>>()
        for (entry in text.split(';').map { it.trim() }.filter { it.isNotEmpty() }) {
            val (name, list) = entry.split('=', limit = 2).let { it.getOrNull(0)?.trim()?.lowercase() to it.getOrNull(1) }
            if (name == null || list == null || !host.matches(name)) continue
            val pins = list.split('|').map { it.trim() }.filter { it.isNotEmpty() }
            // A single pin is a lock-out waiting to happen (a certificate rotation bricks every installed app): require a backup.
            if (pins.size >= 2 && pins.all { pin.matches(it) }) out[name] = pins
        }
        return out
    }
}
