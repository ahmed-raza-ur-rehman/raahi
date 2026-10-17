package pk.raahi.app

import java.io.File
import javax.xml.XMLConstants
import javax.xml.parsers.DocumentBuilderFactory
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import org.w3c.dom.Document
import org.w3c.dom.Element

/**
 * Security and privacy policy for the Android manifest and network configuration, enforced as tests so a careless edit
 * cannot quietly widen what the app is allowed to do (REQ-AND-004, REQ-AND-009, REQ-AND-010).
 */
class ManifestPolicyTest {
    private val android = "http://schemas.android.com/apk/res/android"

    private fun parse(path: String): Document {
        val file = File(path)
        check(file.exists()) { "missing ${file.absolutePath}" }
        val factory = DocumentBuilderFactory.newInstance().apply {
            isNamespaceAware = true
            setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true)
            setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
        }
        return factory.newDocumentBuilder().parse(file)
    }

    private fun Element.attr(name: String): String? = getAttributeNS(android, name).takeIf { it.isNotEmpty() }

    private fun Document.elements(tag: String): List<Element> = (0 until getElementsByTagName(tag).length).map { getElementsByTagName(tag).item(it) as Element }

    private val manifest by lazy { parse("src/main/AndroidManifest.xml") }
    private val application by lazy { manifest.elements("application").single() }

    @Test
    fun `REQ-AND-010 the app asks for exactly three permissions and no others`() {
        val permissions = manifest.elements("uses-permission").map { it.attr("name") }.toSet()
        assertEquals(
            setOf("android.permission.INTERNET", "android.permission.ACCESS_NETWORK_STATE", "android.permission.POST_NOTIFICATIONS"),
            permissions,
            "A new permission is a privacy decision: update docs/mobile/privacy.md and this test together.",
        )
    }

    @Test
    fun `REQ-AND-004 REQ-AND-009 the application is hardened`() {
        assertEquals("false", application.attr("allowBackup"), "no cloud backup of the saved listings database")
        assertEquals("false", application.attr("usesCleartextTraffic"))
        assertEquals("@xml/network_security_config", application.attr("networkSecurityConfig"))
        assertEquals("@xml/data_extraction_rules", application.attr("dataExtractionRules"))
        assertNull(application.attr("debuggable"), "a release must never be debuggable; the build type decides")
        assertNull(application.attr("testOnly"))
        assertNull(application.attr("requestLegacyExternalStorage"))
    }

    @Test
    fun `REQ-AND-009 only the launcher activity is exported and nothing else is reachable from other apps`() {
        val components = listOf("activity", "activity-alias", "service", "receiver", "provider").flatMap { manifest.elements(it) }
        assertTrue(components.isNotEmpty())
        val exported = components.filter { it.attr("exported") == "true" }
        assertEquals(listOf(".MainActivity"), exported.map { it.attr("name") })
        for (component in components) assertTrue(component.attr("exported") != null, "${component.tagName} ${component.attr("name")} must declare android:exported explicitly")
    }

    @Test
    fun `REQ-AND-009 the only intent filter is the launcher entry (no deep links or custom schemes to hijack)`() {
        val filters = manifest.elements("intent-filter")
        assertEquals(1, filters.size)
        val actions = filters.single().getElementsByTagName("action")
        assertEquals("android.intent.action.MAIN", (actions.item(0) as Element).attr("name"))
        assertEquals(0, filters.single().getElementsByTagName("data").length)
    }

    @Test
    fun `REQ-AND-004 release traffic is HTTPS only and trusts only the system certificate store`() {
        val config = parse("src/main/res/xml/network_security_config.xml")
        val base = config.elements("base-config").single()
        assertEquals("false", base.getAttribute("cleartextTrafficPermitted"))
        assertEquals(0, config.elements("domain-config").size, "no per-domain exceptions in the release configuration")
        assertEquals(0, config.elements("debug-overrides").size)
        val anchors = config.elements("certificates").map { it.getAttribute("src") }
        assertEquals(listOf("system"), anchors, "user-installed CAs are not trusted")
    }

    @Test
    fun `REQ-AND-004 the debug overlay allows cleartext only to the emulator host and localhost`() {
        val config = parse("src/debug/res/xml/network_security_config.xml")
        assertEquals("false", config.elements("base-config").single().getAttribute("cleartextTrafficPermitted"))
        val exceptions = config.elements("domain-config")
        assertEquals(1, exceptions.size)
        assertEquals("true", exceptions.single().getAttribute("cleartextTrafficPermitted"))
        assertEquals(setOf("10.0.2.2", "localhost"), config.elements("domain").map { it.textContent.trim() }.toSet())
        assertFalse(File("src/release").exists(), "the release variant must not carry its own network overrides")
    }

    @Test
    fun `REQ-AND-010 nothing is copied off the device by backup or device transfer`() {
        val rules = parse("src/main/res/xml/data_extraction_rules.xml")
        for (section in listOf("cloud-backup", "device-transfer")) {
            val element = rules.elements(section).single()
            assertEquals(0, element.getElementsByTagName("include").length, "$section must not include anything")
            val excluded = (0 until element.getElementsByTagName("exclude").length).map { (element.getElementsByTagName("exclude").item(it) as Element).getAttribute("domain") }.toSet()
            assertTrue(excluded.containsAll(setOf("file", "database", "sharedpref")), "$section must exclude app data: $excluded")
        }
    }

    @Test
    fun `REQ-AND-010 no analytics or advertising SDK is declared as a dependency`() {
        val gradle = File("build.gradle.kts").readText() + File("../gradle/libs.versions.toml").readText()
        for (forbidden in listOf("firebase", "crashlytics", "google-services", "play-services-ads", "facebook", "appsflyer", "adjust", "mixpanel", "amplitude", "segment", "sentry", "datadog")) {
            assertFalse(gradle.contains(forbidden, ignoreCase = true), "$forbidden would add telemetry; see docs/mobile/privacy.md before adding any")
        }
    }
}
