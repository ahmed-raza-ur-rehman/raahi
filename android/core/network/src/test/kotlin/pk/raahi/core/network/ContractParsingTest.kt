package pk.raahi.core.network

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import pk.raahi.core.testing.Fixtures

/**
 * Consumer side of the contract (REQ-API-007): every golden fixture the server produced is decoded by the app's DTOs
 * with `ignoreUnknownKeys = false`, so a field the server sends that a DTO does not declare fails here - long before a
 * user's phone meets it. (At runtime the reader is tolerant; see [ApiJson].)
 */
class ContractParsingTest {
    private val strict = Json {
        ignoreUnknownKeys = false
        explicitNulls = false
    }

    private fun <T> parse(name: String, serializer: KSerializer<T>): T = strict.decodeFromString(serializer, Fixtures.text(name))

    @Serializable
    private data class ToolEnvelope<Q, R>(val request: Q, val response: R)

    @Serializable
    private data class RateLimited(val headers: Map<String, String?>, val body: ProblemDto)

    @Test
    fun `[REQ-API-007] list pages decode, including facets and the cursor`() {
        val list = parse("opportunities.list.json", ListResponseDto.serializer())
        assertEquals(5, list.data.size)
        assertNotNull(list.page.nextCursor)
        assertNotNull(list.facets)
        assertTrue(list.data.all { it.rev.matches(Regex("[a-f0-9]{12}")) && it.kind == "scholarship" })
        val next = parse("opportunities.list.next.json", ListResponseDto.serializer())
        assertTrue(next.data.map { it.id }.intersect(list.data.map { it.id }.toSet()).isEmpty(), "page 2 must not repeat page 1")
    }

    @Test
    fun `[REQ-API-007] detail, programmes, guides and resources decode`() {
        val detail = parse("opportunities.detail.json", DetailResponseDto.serializer())
        assertTrue(detail.data.id.isNotBlank())
        val programmes = parse("programmes.list.json", ProgrammeListDto.serializer())
        assertEquals(3, programmes.data.size)
        assertTrue(programmes.data.all { programme -> programme.cycle?.confidence?.let { it in setOf("official", "reported") } ?: true })
        val urdu = parse("programmes.list.ur.json", ProgrammeListDto.serializer()).data.single()
        assertTrue(urdu.summary.any { it in '\u0600'..'\u06FF' }, "lang=ur returns Urdu text")
        assertEquals(urdu.id, parse("programmes.detail.json", ProgrammeDetailDto.serializer()).data.id)
        val guides = parse("guides.list.json", GuideListDto.serializer())
        assertEquals(3, guides.data.size)
        val guide = parse("guides.detail.json", GuideDetailResponseDto.serializer()).data
        assertTrue(guide.steps.isNotEmpty() && guide.resources.isNotEmpty())
        val resources = parse("resources.list.json", ResourceListDto.serializer())
        assertTrue(resources.total >= resources.data.size && resources.data.isNotEmpty())
    }

    @Test
    fun `[REQ-API-007] tools and problem documents decode`() {
        val scam = parse("tools.scam-check.json", ToolEnvelope.serializer(ScamRequestDto.serializer(), ScamResponseDto.serializer()))
        assertTrue(scam.response.data.signals.isNotEmpty() && scam.response.data.level in setOf("high", "medium"))
        for (name in listOf("unknown-parameter", "validation-failed", "unauthorized", "token-expired")) {
            val problem = parse("problems.$name.json", ProblemDto.serializer())
            assertTrue(problem.type.startsWith("urn:raahi:problem:") && problem.requestId == "fixture-request-0001", name)
        }
        assertEquals("token_expired", parse("problems.token-expired.json", ProblemDto.serializer()).code)
        val limited = parse("problems.rate-limited.json", RateLimited.serializer())
        assertEquals("rate_limited", limited.body.code)
        assertTrue(limited.headers.getValue("Retry-After")!!.toInt() >= 1)
    }

    @Test
    fun `[REQ-API-009] the sync fixtures decode and agree with each other`() {
        val manifest1 = parse("sync/manifest.v1.json", ManifestResponseDto.serializer())
        val items1 = parse("sync/items.v1.json", ListSerializer(OpportunityDto.serializer()))
        assertEquals(manifest1.data.map { it.id to it.rev }, items1.map { it.id to it.rev })
        assertEquals(manifest1.meta.count, manifest1.data.size)
        val manifest2 = parse("sync/manifest.v2.json", ManifestResponseDto.serializer())
        val items2 = parse("sync/items.v2.json", ListSerializer(OpportunityDto.serializer()))
        assertEquals(manifest2.data.map { it.id to it.rev }, items2.map { it.id to it.rev })
    }

    @Test
    fun `[REQ-API-007] a newer server that adds fields does not break the tolerant runtime reader`() {
        val withExtra = Fixtures.text("sync/manifest.v1.json").replaceFirst("{", "{\"futureField\":{\"a\":1},")
        val parsed = ApiJson.decodeFromString(ManifestResponseDto.serializer(), withExtra)
        assertTrue(parsed.data.isNotEmpty())
    }
}
