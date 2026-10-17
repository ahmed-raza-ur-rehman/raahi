package pk.raahi.core.data

import java.time.Instant
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import pk.raahi.core.database.CachedDocumentEntity
import pk.raahi.core.database.DocumentDao
import pk.raahi.core.network.ApiError
import pk.raahi.core.network.ApiJson
import pk.raahi.core.network.ApiResult
import pk.raahi.core.network.GuideDetailResponseDto
import pk.raahi.core.network.GuideListDto
import pk.raahi.core.network.ProgrammeListDto
import pk.raahi.core.network.RaahiApi
import pk.raahi.core.network.ResourceListDto

/** What a screen needs to draw a network-backed document: the data it has (maybe stale), whether it is refreshing, and any error. */
data class DocState<out T>(
    val data: T? = null,
    val loading: Boolean = false,
    val error: ApiError? = null,
    val fetchedAt: Instant? = null,
)

/** Programmes, guides and the resource directory as the screens consume them. */
interface DocumentSource {
    fun programmes(language: String): Flow<DocState<ProgrammeListDto>>

    fun guides(language: String): Flow<DocState<GuideListDto>>

    fun guide(id: String, language: String): Flow<DocState<GuideDetailResponseDto>>

    fun resources(language: String): Flow<DocState<ResourceListDto>>
}

/**
 * Programmes, guides and the resource directory: stale-while-revalidate. The cached copy is shown immediately (so the
 * screen works offline and never starts blank), a refresh runs in the background, and a failed refresh keeps the cached
 * data on screen with the error alongside instead of replacing it with an error page.
 */
class DocumentRepository(
    private val api: RaahiApi,
    private val dao: DocumentDao,
    private val clock: TimeSource,
    private val json: Json = ApiJson,
) : DocumentSource {
    override fun programmes(language: String): Flow<DocState<ProgrammeListDto>> = cached("programmes:$language", ProgrammeListDto.serializer()) { api.programmes(language) }

    override fun guides(language: String): Flow<DocState<GuideListDto>> = cached("guides:$language", GuideListDto.serializer()) { api.guides(language) }

    override fun guide(id: String, language: String): Flow<DocState<GuideDetailResponseDto>> = cached("guide:$id:$language", GuideDetailResponseDto.serializer()) { api.guide(id, language) }

    override fun resources(language: String): Flow<DocState<ResourceListDto>> = cached("resources:$language", ResourceListDto.serializer()) { api.resources(language) }

    private fun <T> cached(key: String, serializer: KSerializer<T>, fetch: suspend () -> ApiResult<T>): Flow<DocState<T>> = flow {
        val stored = dao.get(key)
        val storedValue = stored?.let { runCatching { json.decodeFromString(serializer, it.json) }.getOrNull() }
        val storedAt = stored?.fetchedAt?.let(Instant::ofEpochMilli)
        emit(DocState(storedValue, loading = true, fetchedAt = storedAt))
        when (val result = fetch()) {
            is ApiResult.Success -> {
                val now = clock.now()
                dao.put(CachedDocumentEntity(key, json.encodeToString(serializer, result.value), now.toEpochMilli()))
                emit(DocState(result.value, fetchedAt = now))
            }
            is ApiResult.Failure -> emit(DocState(storedValue, error = result.error, fetchedAt = storedAt))
            ApiResult.NotModified -> emit(DocState(storedValue, fetchedAt = storedAt))
        }
    }
}
