package pk.raahi.core.data

import java.time.LocalDate
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import pk.raahi.core.database.OpportunityDao
import pk.raahi.core.database.OpportunityEntity
import pk.raahi.core.database.OpportunityQueryBuilder
import pk.raahi.core.database.SavedDao
import pk.raahi.core.database.SavedEntity
import pk.raahi.core.database.SyncStateDao
import pk.raahi.core.model.Opportunity
import pk.raahi.core.model.OpportunityFilter
import pk.raahi.core.model.Ranking

/** What the screens need from the listings data. Screens depend on this interface so they can be tested with fakes. */
interface OpportunityRepository {
    fun observe(filter: OpportunityFilter, today: LocalDate): Flow<List<Opportunity>>

    fun observeById(id: String): Flow<Opportunity?>

    fun observeCount(): Flow<Int>

    fun observeSavedIds(): Flow<Set<String>>

    fun observeSaved(): Flow<List<Opportunity>>

    fun observeSyncState(): Flow<SyncState>

    /** Bookmark (with the given "N days before" reminders) or un-bookmark. */
    suspend fun setSaved(id: String, save: Boolean, reminderDays: Set<Int>)

    suspend fun setReminderDays(reminderDays: Set<Int>)

    suspend fun refresh(): SyncOutcome
}

/**
 * The single source of truth for listings: everything is read from the on-device database (offline first); the network
 * only ever feeds the database through [SyncEngine]. Screens observe flows and never wait on the network.
 */
class DefaultOpportunityRepository(
    private val dao: OpportunityDao,
    private val saved: SavedDao,
    private val syncState: SyncStateDao,
    private val engine: SyncEngine,
    private val clock: TimeSource,
) : OpportunityRepository {
    override fun observe(filter: OpportunityFilter, today: LocalDate): Flow<List<Opportunity>> =
        dao.observe(OpportunityQueryBuilder.build(filter, today)).map { rows ->
            val now = clock.now()
            rows.map(OpportunityEntity::toDomain).sortedWith(Ranking.comparator(filter.sort, now))
        }

    override fun observeById(id: String): Flow<Opportunity?> = dao.observeById(id).map { it?.toDomain() }

    override fun observeCount(): Flow<Int> = dao.observeCount()

    override fun observeSavedIds(): Flow<Set<String>> = saved.observeIds().map { it.toSet() }

    override fun observeSaved(): Flow<List<Opportunity>> = saved.observeOpportunities().map { rows -> rows.map(OpportunityEntity::toDomain) }

    override fun observeSyncState(): Flow<SyncState> = syncState.observe().map { it?.toState() ?: SyncState() }

    override suspend fun setSaved(id: String, save: Boolean, reminderDays: Set<Int>) {
        if (save) saved.save(SavedEntity(id, clock.now().toEpochMilli(), reminderDays.sorted().joinToString(","))) else saved.remove(id)
    }

    override suspend fun setReminderDays(reminderDays: Set<Int>) = saved.setReminderDaysForAll(reminderDays.sorted().joinToString(","))

    override suspend fun refresh(): SyncOutcome = engine.sync()
}
