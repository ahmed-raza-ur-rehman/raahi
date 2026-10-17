package pk.raahi.core.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Wire format of the v1 API. These classes mirror `lib/api/v1/schemas.ts`; the golden fixtures in `contract/v1` are
 * parsed into them by the tests with `ignoreUnknownKeys = false`, so a field the server sends and a DTO lacks fails
 * the build. At RUNTIME the reader is tolerant (`ApiJson`): a field added by a newer server is ignored.
 */
val ApiJson: Json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    coerceInputValues = true
    isLenient = false
}

@Serializable
data class SourceDto(val id: String, val name: String, val url: String)

@Serializable
data class AlsoOnDto(val sourceName: String, val url: String)

@Serializable
data class OpportunityDto(
    val id: String,
    val rev: String,
    val kind: String,
    val scope: String,
    val title: String,
    val organization: String? = null,
    val summary: String? = null,
    val url: String,
    val applyUrl: String? = null,
    val source: SourceDto,
    val country: String? = null,
    val location: String? = null,
    val remote: Boolean? = null,
    val levels: List<String> = emptyList(),
    val fields: List<String> = emptyList(),
    val tags: List<String> = emptyList(),
    val funding: String? = null,
    val deadline: String? = null,
    val deadlineText: String? = null,
    val rolling: Boolean? = null,
    val postedAt: String? = null,
    val startsAt: String? = null,
    val firstSeen: String,
    val lastSeen: String,
    val openToPakistan: Boolean? = null,
    val eligibilityNote: String? = null,
    val languages: List<String>? = null,
    val alsoOn: List<AlsoOnDto>? = null,
    val status: String,
    val daysLeft: Int? = null,
    val isNew: Boolean = false,
)

@Serializable
data class MetaDto(val generatedAt: String? = null, val dataVersion: String)

@Serializable
data class PageDto(val total: Int, val limit: Int, val nextCursor: String? = null)

@Serializable
data class CorrectionDto(val from: String, val to: String)

@Serializable
data class CorrectedDto(val from: String, val to: String, val changes: List<CorrectionDto> = emptyList())

@Serializable
data class InterpretedDto(
    val terms: List<String> = emptyList(),
    val kinds: List<String>? = null,
    val country: String? = null,
    val level: String? = null,
    val funding: String? = null,
    val scope: String? = null,
    val deadlineWithinDays: Int? = null,
    val remote: Boolean? = null,
    val corrected: CorrectedDto? = null,
)

@Serializable
data class FacetCountDto(val value: String, val count: Int)

@Serializable
data class FacetsDto(
    val kind: List<FacetCountDto> = emptyList(),
    val scope: List<FacetCountDto> = emptyList(),
    val country: List<FacetCountDto> = emptyList(),
    val level: List<FacetCountDto> = emptyList(),
    val funding: List<FacetCountDto> = emptyList(),
    val source: List<FacetCountDto> = emptyList(),
)

@Serializable
data class ListResponseDto(val data: List<OpportunityDto>, val page: PageDto, val interpreted: InterpretedDto, val facets: FacetsDto? = null, val meta: MetaDto)

@Serializable
data class DetailResponseDto(val data: OpportunityDto, val related: List<OpportunityDto> = emptyList(), val meta: MetaDto)

@Serializable
data class ManifestEntryDto(val id: String, val rev: String)

@Serializable
data class ManifestMetaDto(val generatedAt: String? = null, val dataVersion: String, val count: Int)

@Serializable
data class ManifestResponseDto(val data: List<ManifestEntryDto>, val meta: ManifestMetaDto)

@Serializable
data class BatchResponseDto(val data: List<OpportunityDto>, val missing: List<String> = emptyList(), val meta: MetaDto)

// ─── Programmes, guides, resources ───────────────────────────────────────────

@Serializable
data class CycleDto(
    val label: String,
    val opens: String? = null,
    val closes: String? = null,
    val closesNote: String? = null,
    val note: String? = null,
    /** `official` = read on the organiser's own page; `reported` = from news or a summary - confirm before relying on it. */
    val confidence: String,
    val checked: String,
    val source: String,
)

@Serializable
data class ProgrammeDto(
    val id: String,
    val kind: String,
    val title: String,
    val provider: String,
    @SerialName("where") val place: String,
    val levels: List<String> = emptyList(),
    val funding: String,
    val summary: String,
    val route: String,
    val routeNote: String,
    val usualWindow: String,
    val variable: Boolean = false,
    val phase: String,
    val daysLeft: Int? = null,
    val daysToOpen: Int? = null,
    val monthsToOpen: Int = 0,
    val prepareNow: Boolean = false,
    val prepare: List<String> = emptyList(),
    val cycle: CycleDto? = null,
    val official: String,
    val reviewed: String,
)

@Serializable
data class ProgrammeListDto(val data: List<ProgrammeDto>, val today: String)

@Serializable
data class ProgrammeDetailDto(val data: ProgrammeDto)

@Serializable
data class GuideSummaryDto(
    val id: String,
    val category: String,
    val emoji: String,
    val title: String,
    val summary: String,
    val steps: Int,
    val duration: String? = null,
    val reviewed: String,
    val url: String,
)

@Serializable
data class GuideListDto(val data: List<GuideSummaryDto>)

@Serializable
data class GuideStepDto(val title: String, val body: String, @SerialName("when") val timing: String? = null, val resourceIds: List<String> = emptyList())

@Serializable
data class GuideResourceDto(val id: String, val name: String, val url: String)

@Serializable
data class GuideDetailDto(
    val id: String,
    val category: String,
    val emoji: String,
    val title: String,
    val summary: String,
    val duration: String? = null,
    val reviewed: String,
    val url: String,
    val audience: String,
    val steps: List<GuideStepDto> = emptyList(),
    val checklist: List<String> = emptyList(),
    val pitfalls: List<String> = emptyList(),
    val resources: List<GuideResourceDto> = emptyList(),
    val related: List<String> = emptyList(),
    val tools: List<String> = emptyList(),
    val sources: List<String> = emptyList(),
)

@Serializable
data class GuideDetailResponseDto(val data: GuideDetailDto)

@Serializable
data class ResourceDto(
    val id: String,
    val name: String,
    val description: String,
    val url: String,
    val category: String,
    val scope: String,
    val authority: Int,
    val tags: List<String> = emptyList(),
    val free: Boolean? = null,
    val checked: String? = null,
    val note: String? = null,
    val linkStatus: String? = null,
)

@Serializable
data class ResourceListDto(val data: List<ResourceDto>, val total: Int)

// ─── Tools ────────────────────────────────────────────────────────────────────

@Serializable
data class ScamRequestDto(val text: String? = null, val answers: Map<String, Boolean>? = null)

@Serializable
data class BilingualDto(val en: String, val ur: String)

@Serializable
data class SignalDto(val id: String, val weight: Double, val en: String, val ur: String, val source: String)

@Serializable
data class OepLicenceDto(val raw: String, val number: String, val city: String)

@Serializable
data class AdviceDto(val en: String, val ur: String, val url: String? = null, val label: BilingualDto? = null)

@Serializable
data class ScamAnalysisDto(
    val score: Int,
    val level: String,
    val signals: List<SignalDto> = emptyList(),
    val oepLicences: List<OepLicenceDto> = emptyList(),
    val advice: List<AdviceDto> = emptyList(),
    val headline: BilingualDto,
    val disclaimer: BilingualDto,
)

@Serializable
data class ScamResponseDto(val data: ScamAnalysisDto)

// ─── Service and authentication ──────────────────────────────────────────────

@Serializable
data class ApiInfoDto(val version: String, val build: String, val minimumClient: MinimumClientDto, val deprecated: List<String> = emptyList())

@Serializable
data class MinimumClientDto(val android: String)

@Serializable
data class ServerInfoDto(val time: String)

@Serializable
data class DataInfoDto(val generatedAt: String? = null, val total: Int, val ageHours: Double? = null, val stale: Boolean, val dataVersion: String)

@Serializable
data class FeaturesDto(val deviceAuth: Boolean, val assistant: Boolean)

@Serializable
data class MetaResponseDto(val api: ApiInfoDto, val server: ServerInfoDto, val data: DataInfoDto, val features: FeaturesDto)

@Serializable
data class ChallengeDto(val challenge: String, val algorithm: String, val difficulty: Int, val expiresAt: String)

@Serializable
data class DeviceRequestDto(val challenge: String, val nonce: String, val installId: String, val platform: String)

@Serializable
data class DeviceResponseDto(val accessToken: String, val tokenType: String, val expiresIn: Int, val scope: String)

@Serializable
data class FieldErrorDto(val path: String, val code: String, val message: String)

/** RFC 9457 problem document. `code` is the stable machine-readable part. */
@Serializable
data class ProblemDto(
    val type: String,
    val title: String,
    val status: Int,
    val code: String,
    val detail: String? = null,
    val instance: String? = null,
    val requestId: String? = null,
    val errors: List<FieldErrorDto>? = null,
)
