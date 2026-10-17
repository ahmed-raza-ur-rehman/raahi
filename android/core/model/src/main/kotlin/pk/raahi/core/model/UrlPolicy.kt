package pk.raahi.core.model

import java.net.URI
import java.net.URISyntaxException

/**
 * Which links the app will open. The server already rejects hostile URLs; this is the second, independent check on
 * the device (defence in depth) because the app is the last stop before a person taps and leaves.
 */
object UrlPolicy {
    private val ipv4 = Regex("^\\d{1,3}(\\.\\d{1,3}){3}$")

    fun isUnsafeHost(host: String): Boolean {
        val h = host.lowercase().trimEnd('.')
        if (h.isEmpty()) return true
        if (h == "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) return true
        if (!h.contains('.') && !h.contains(':')) return true
        return ipv4.matches(h) || h.startsWith("[") || h.contains(':')
    }

    /** http(s) only, no embedded credentials, a real public host name, and a sane length. */
    fun isSafeToOpen(url: String): Boolean {
        if (url.length > 2048 || url.any { it.isISOControl() }) return false
        val uri = try {
            URI(url.trim())
        } catch (_: URISyntaxException) {
            return false
        }
        val scheme = uri.scheme?.lowercase() ?: return false
        if (scheme != "https" && scheme != "http") return false
        if (uri.userInfo != null) return false
        val host = uri.host ?: return false
        return !isUnsafeHost(host)
    }
}
