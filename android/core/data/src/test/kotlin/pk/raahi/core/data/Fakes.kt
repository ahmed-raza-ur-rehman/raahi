package pk.raahi.core.data

import java.time.Instant
import kotlinx.serialization.builtins.ListSerializer
import pk.raahi.core.model.Opportunity
import pk.raahi.core.network.ApiError
import pk.raahi.core.network.ApiInfoDto
import pk.raahi.core.network.ApiJson
import pk.raahi.core.network.ApiResult
import pk.raahi.core.network.BatchResponseDto
import pk.raahi.core.network.DataInfoDto
import pk.raahi.core.network.FeaturesDto
import pk.raahi.core.network.GuideDetailResponseDto
import pk.raahi.core.network.GuideListDto
import pk.raahi.core.network.ManifestEntryDto
import pk.raahi.core.network.ManifestMetaDto
import pk.raahi.core.network.ManifestResponseDto
import pk.raahi.core.network.MetaDto
import pk.raahi.core.network.MetaResponseDto
import pk.raahi.core.network.MinimumClientDto
import pk.raahi.core.network.OpportunityDto
import pk.raahi.core.network.ProgrammeListDto
import pk.raahi.core.network.RaahiApi
import pk.raahi.core.network.ResourceListDto
import pk.raahi.core.network.ScamRequestDto
import pk.raahi.core.network.ScamResponseDto
import pk.raahi.core.network.ServerInfoDto
import pk.raahi.core.testing.Fixtures

internal val NOW: Instant = Instant.parse("2026-10-15T08:00:00Z")

internal fun fixtureItems(version: Int): List<OpportunityDto> =
    ApiJson.decodeFromString(ListSerializer(OpportunityDto.serializer()), Fixtures.text("sync/items.v$version.json"))

/** A scripted server: a world of listings, an ETag that changes when the world does, and switches for failures. */
internal class FakeRaahiApi(var world: List<OpportunityDto>, var minimumClient: String = "1.0.0") : RaahiApi {
    var generation = 1
    var metaFails = false
    var manifestFails: ApiError? = null
    var failBatchNumber: Int? = null
    var manifestCalls = 0
    val batches = mutableListOf<List<String>>()

    fun publish(next: List<OpportunityDto>) {
        world = next
        generation += 1
    }

    override suspend fun meta(): ApiResult<MetaResponseDto> =
        if (metaFails) ApiResult.Failure(ApiError.Offline)
        else ApiResult.Success(MetaResponseDto(ApiInfoDto("1", "test", MinimumClientDto(minimumClient)), ServerInfoDto("2026-10-15T08:00:00Z"), DataInfoDto(null, world.size, null, false, "dv$generation"), FeaturesDto(deviceAuth = true, assistant = false)))

    override suspend fun manifest(ifNoneMatch: String?): ApiResult<ManifestResponseDto> {
        manifestCalls += 1
        manifestFails?.let { return ApiResult.Failure(it) }
        val etag = "W/\"v$generation\""
        if (ifNoneMatch == etag) return ApiResult.NotModified
        return ApiResult.Success(ManifestResponseDto(world.map { ManifestEntryDto(it.id, it.rev) }, ManifestMetaDto(null, "dv$generation", world.size)), etag)
    }

    override suspend fun batch(ids: List<String>): ApiResult<BatchResponseDto> {
        batches.add(ids)
        if (failBatchNumber == batches.size) return ApiResult.Failure(ApiError.Server(503))
        val byId = world.associateBy { it.id }
        return ApiResult.Success(BatchResponseDto(ids.mapNotNull(byId::get), ids.filter { it !in byId }, MetaDto(null, "dv$generation")))
    }

    override suspend fun programmes(language: String, query: String?): ApiResult<ProgrammeListDto> = ApiResult.Failure(ApiError.NotFound)

    override suspend fun guides(language: String): ApiResult<GuideListDto> = ApiResult.Failure(ApiError.NotFound)

    override suspend fun guide(id: String, language: String): ApiResult<GuideDetailResponseDto> = ApiResult.Failure(ApiError.NotFound)

    override suspend fun resources(language: String, category: String?): ApiResult<ResourceListDto> = ApiResult.Failure(ApiError.NotFound)

    override suspend fun scamCheck(request: ScamRequestDto): ApiResult<ScamResponseDto> = ApiResult.Failure(ApiError.Unauthorized(expired = false))
}

internal class InMemoryStore : OpportunityStore {
    val items = LinkedHashMap<String, Opportunity>()
    val removals = mutableListOf<Collection<String>>()
    var failNextApply = false

    override suspend fun revisions(): Map<String, String> = items.mapValues { it.value.rev }

    override suspend fun apply(upserts: List<Opportunity>, removeIds: Collection<String>): Int {
        if (failNextApply) {
            failNextApply = false
            error("simulated crash during apply")
        }
        upserts.forEach { items[it.id] = it }
        removals.add(removeIds)
        return removeIds.count { items.remove(it) != null }
    }
}

internal class InMemorySyncState : SyncStateStore {
    var current = SyncState()

    override suspend fun load() = current

    override suspend fun save(state: SyncState) {
        current = state
    }
}
