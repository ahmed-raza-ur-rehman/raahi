package pk.raahi.core.data

import java.time.Instant
import pk.raahi.core.database.OpportunityDao
import pk.raahi.core.database.SyncStateDao
import pk.raahi.core.database.SyncStateEntity
import pk.raahi.core.model.Opportunity

class RoomOpportunityStore(private val dao: OpportunityDao) : OpportunityStore {
    override suspend fun revisions(): Map<String, String> = dao.revisions().associate { it.id to it.rev }

    override suspend fun apply(upserts: List<Opportunity>, removeIds: Collection<String>): Int =
        dao.applyChanges(upserts.map { it.toEntity() }, upserts.map { it.toFts() }, removeIds.toList())
}

class RoomSyncStateStore(private val dao: SyncStateDao) : SyncStateStore {
    override suspend fun load(): SyncState = dao.get()?.toState() ?: SyncState()

    override suspend fun save(state: SyncState) {
        dao.put(
            SyncStateEntity(
                manifestEtag = state.manifestEtag,
                dataVersion = state.dataVersion,
                lastAttemptAt = state.lastAttemptAt?.toEpochMilli(),
                lastSuccessAt = state.lastSuccessAt?.toEpochMilli(),
                lastError = state.lastError,
            ),
        )
    }
}

fun SyncStateEntity.toState() = SyncState(
    manifestEtag = manifestEtag,
    dataVersion = dataVersion,
    lastAttemptAt = lastAttemptAt?.let(Instant::ofEpochMilli),
    lastSuccessAt = lastSuccessAt?.let(Instant::ofEpochMilli),
    lastError = lastError,
)
