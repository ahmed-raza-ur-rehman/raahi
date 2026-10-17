package pk.raahi.core.data

import java.time.Instant
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import pk.raahi.core.model.Opportunity
import pk.raahi.core.model.SemVer
import pk.raahi.core.network.ApiError
import pk.raahi.core.network.ApiResult
import pk.raahi.core.network.BatchResponseDto
import pk.raahi.core.network.RaahiApi

/** Where the synchronised data lives. Room implements it for the app; tests use an in-memory fake. */
interface OpportunityStore {
    /** id -> content revision of everything stored. */
    suspend fun revisions(): Map<String, String>

    /** Apply a whole synchronisation result atomically. Returns how many listings were really deleted (saved ones are kept). */
    suspend fun apply(upserts: List<Opportunity>, removeIds: Collection<String>): Int
}

data class SyncState(
    val manifestEtag: String? = null,
    val dataVersion: String? = null,
    val lastAttemptAt: Instant? = null,
    val lastSuccessAt: Instant? = null,
    val lastError: String? = null,
)

interface SyncStateStore {
    suspend fun load(): SyncState

    suspend fun save(state: SyncState)
}

sealed interface SyncOutcome {
    /** The server's data has not changed since the last successful sync (one conditional request, ~no bytes). */
    data object UpToDate : SyncOutcome

    data class Updated(val added: Int, val changed: Int, val removed: Int, val skipped: Int) : SyncOutcome

    /** The server requires a newer app. Nothing was changed. */
    data class UpdateRequired(val minimumVersion: String) : SyncOutcome

    data class Failed(val error: ApiError) : SyncOutcome
}

/**
 * Delta synchronisation with the server's manifest + batch protocol (docs/api/sync.md):
 *
 *  1. `meta` - if the server demands a newer app, stop (the UI shows the update screen).
 *  2. `manifest` with `If-None-Match` - 304 means nothing changed: done in one tiny request.
 *  3. diff the manifest's (id, rev) pairs against what is stored: changed or missing ids are fetched, ids no longer
 *     listed are removed.
 *  4. fetch the changed items with `batch`, [concurrency] requests at a time, 50 ids each.
 *  5. apply everything in ONE transaction, and only then remember the manifest's ETag.
 *
 * Properties (all tested): idempotent (a second sync is a no-op), crash-safe and resumable (nothing is applied or
 * remembered until every batch has arrived, so an interruption just repeats the diff next time), saved listings survive
 * their removal, and one malformed record is skipped rather than failing the whole sync.
 */
class SyncEngine(
    private val api: RaahiApi,
    private val store: OpportunityStore,
    private val state: SyncStateStore,
    private val clock: TimeSource,
    private val appVersion: SemVer,
    private val concurrency: Int = 2,
) {
    suspend fun sync(): SyncOutcome {
        val startedAt = clock.now()
        val previous = state.load()

        when (val meta = api.meta()) {
            is ApiResult.Success -> {
                val required = SemVer.parse(meta.value.api.minimumClient.android)
                if (required != null && appVersion < required) {
                    state.save(previous.copy(lastAttemptAt = startedAt, lastError = "update required"))
                    return SyncOutcome.UpdateRequired(required.toString())
                }
            }
            // The gate is advisory: if meta is unreachable we still try the manifest, whose failure is reported properly.
            is ApiResult.Failure, ApiResult.NotModified -> Unit
        }

        val manifest = when (val result = api.manifest(previous.manifestEtag)) {
            ApiResult.NotModified -> {
                state.save(previous.copy(lastAttemptAt = startedAt, lastSuccessAt = startedAt, lastError = null))
                return SyncOutcome.UpToDate
            }
            is ApiResult.Failure -> return fail(previous, startedAt, result.error)
            is ApiResult.Success -> result
        }

        val local = store.revisions()
        val remote = manifest.value.data.associate { it.id to it.rev }
        val toFetch = remote.filter { (id, rev) -> local[id] != rev }.keys.toList()
        val toRemove = local.keys - remote.keys

        val fetched = LinkedHashMap<String, Opportunity>()
        var skipped = 0
        val missingOnServer = mutableSetOf<String>()
        if (toFetch.isNotEmpty()) {
            val gate = Semaphore(concurrency.coerceAtLeast(1))
            val batches: List<ApiResult<BatchResponseDto>> = coroutineScope {
                toFetch.chunked(RaahiApi.BATCH_MAX).map { ids -> async { gate.withPermit { api.batch(ids) } } }.awaitAll()
            }
            for (result in batches) {
                val batch = when (result) {
                    is ApiResult.Success -> result.value
                    is ApiResult.Failure -> return fail(previous, startedAt, result.error)
                    ApiResult.NotModified -> return fail(previous, startedAt, ApiError.Malformed("unexpected 304 for a batch"))
                }
                missingOnServer += batch.missing
                for (dto in batch.data) {
                    if (dto.id !in remote) continue // never store something the manifest did not announce
                    val item = dto.toDomainOrNull()
                    if (item == null) skipped += 1 else fetched[item.id] = item
                }
            }
        }

        val removed = store.apply(fetched.values.toList(), toRemove + missingOnServer)
        val added = fetched.keys.count { it !in local }
        state.save(
            SyncState(
                manifestEtag = if (skipped == 0) manifest.etag else null, // an incomplete sync must be retried in full
                dataVersion = manifest.value.meta.dataVersion,
                lastAttemptAt = startedAt,
                lastSuccessAt = startedAt,
                lastError = null,
            ),
        )
        return SyncOutcome.Updated(added = added, changed = fetched.size - added, removed = removed, skipped = skipped)
    }

    private suspend fun fail(previous: SyncState, at: Instant, error: ApiError): SyncOutcome.Failed {
        state.save(previous.copy(lastAttemptAt = at, lastError = describe(error)))
        return SyncOutcome.Failed(error)
    }

    private fun describe(error: ApiError): String = when (error) {
        ApiError.Offline -> "offline"
        ApiError.Timeout -> "timeout"
        is ApiError.RateLimited -> "rate limited"
        is ApiError.Server -> "server error ${error.status}"
        is ApiError.Insecure -> "insecure connection"
        else -> error.javaClass.simpleName
    }
}
