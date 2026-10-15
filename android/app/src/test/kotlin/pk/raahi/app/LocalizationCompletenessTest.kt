package pk.raahi.app

import java.io.File
import javax.xml.parsers.DocumentBuilderFactory
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.w3c.dom.Element

/**
 * REQ-AND-005: every string exists in English and Urdu, with the same placeholders, in every module. A missing or
 * mismatched translation fails the build instead of showing English (or crashing a format call) to an Urdu reader.
 */
class LocalizationCompletenessTest {
    private val root = File("..").canonicalFile
    private val modules = listOf("app", "feature/opportunities", "feature/planner", "feature/tools")
    private val placeholder = Regex("%(\\d+\\$)?[sd]")
    private val arabicScript = Regex("[\\u0600-\\u06FF]")

    private fun load(file: File): Map<String, String> {
        val factory = DocumentBuilderFactory.newInstance().apply { setFeature("http://apache.org/xml/features/disallow-doctype-decl", true) }
        val resources = factory.newDocumentBuilder().parse(file).documentElement
        val out = linkedMapOf<String, String>()
        for (index in 0 until resources.childNodes.length) {
            val node = resources.childNodes.item(index) as? Element ?: continue
            when (node.tagName) {
                "string" -> out["string:${node.getAttribute("name")}"] = node.textContent
                "plurals" -> for (item in 0 until node.getElementsByTagName("item").length) {
                    val element = node.getElementsByTagName("item").item(item) as Element
                    out["plurals:${node.getAttribute("name")}:${element.getAttribute("quantity")}"] = element.textContent
                }
            }
        }
        return out
    }

    private fun forEachModule(check: (module: String, english: Map<String, String>, urdu: Map<String, String>) -> Unit) {
        for (module in modules) {
            val english = File(root, "$module/src/main/res/values/strings.xml")
            val urdu = File(root, "$module/src/main/res/values-ur/strings.xml")
            assertTrue(english.exists() && urdu.exists(), "$module must have both values/strings.xml and values-ur/strings.xml")
            check(module, load(english), load(urdu))
        }
    }

    @Test
    fun `REQ-AND-005 every English string has an Urdu translation and vice versa`() = forEachModule { module, english, urdu ->
        assertTrue(english.size >= 8, "$module has suspiciously few strings: ${english.size}")
        val plurals = { map: Map<String, String> -> map.keys.filter { it.startsWith("plurals:") }.map { it.substringBeforeLast(':') }.toSet() }
        assertEquals(plurals(english), plurals(urdu), "$module: the same plurals must exist in both languages")
        val onlyEnglish = english.keys.filterNot { it in urdu || it.startsWith("plurals:") }
        val onlyUrdu = urdu.keys.filterNot { it in english || it.startsWith("plurals:") }
        assertTrue(onlyEnglish.isEmpty(), "$module: missing Urdu for $onlyEnglish")
        assertTrue(onlyUrdu.isEmpty(), "$module: Urdu strings with no English original: $onlyUrdu")
    }

    @Test
    fun `REQ-AND-005 translations keep the same format placeholders`() = forEachModule { module, english, urdu ->
        for ((key, value) in english) {
            val other = urdu[key] ?: urdu.entries.firstOrNull { it.key.substringBeforeLast(':') == key.substringBeforeLast(':') }?.value ?: continue
            val a = placeholder.findAll(value).map { it.value }.sorted().toList()
            val b = placeholder.findAll(other).map { it.value }.sorted().toList()
            assertEquals(a, b, "$module $key: placeholders differ between English and Urdu")
        }
    }

    @Test
    fun `REQ-AND-005 Urdu text is really Urdu - Arabic script - unless it deliberately matches the English`() = forEachModule { module, english, urdu ->
        for ((key, value) in urdu) {
            val original = english[key] ?: continue
            assertTrue(value.isNotBlank(), "$module $key is empty")
            assertTrue(arabicScript.containsMatchIn(value) || value == original, "$module $key does not look like Urdu: $value")
        }
    }

    @Test
    fun `REQ-AND-005 no string is blank or ends with stray whitespace`() = forEachModule { module, english, urdu ->
        for ((language, map) in listOf("en" to english, "ur" to urdu)) {
            for ((key, value) in map) assertTrue(value.isNotBlank() && value == value.trim(), "$module [$language] $key has blank or padded text")
        }
    }
}
