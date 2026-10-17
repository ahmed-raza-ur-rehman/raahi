package pk.raahi.core.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.RawQuery
import androidx.room.Transaction
import androidx.room.Upsert
import androidx.sqlite.db.SupportSQLiteQuery
import kotlinx.coroutines.flow.Flow

@Dao
abstract class OpportunityDao {
    /** Dynamic filter query built by [OpportunityQueryBuilder] (all values bound as arguments, never concatenated). */
    @RawQuery(observedEntities = [OpportunityEntity::class, OpportunityFts::class])
    abstract fun observe(query: SupportSQLiteQuery): Flow<List<OpportunityEntity>>

    @Query("SELECT * FROM opportunities WHERE id = :id")
    abstract fun observeById(id: String): Flow<OpportunityEntity?>

    @Query("SELECT * FROM opportunities WHERE id = :id")
    abstract suspend fun getById(id: String): OpportunityEntity?

    @Query("SELECT id, rev FROM opportunities")
    abstract suspend fun revisions(): List<IdRev>

    @Query("SELECT COUNT(*) FROM opportunities")
    abstract suspend fun count(): Int

    @Query("SELECT COUNT(*) FROM opportunities")
    abstract fun observeCount(): Flow<Int>

    @Upsert
    abstract suspend fun upsertRows(rows: List<OpportunityEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    abstract suspend fun insertFts(rows: List<OpportunityFts>)

    @Query("DELETE FROM opportunity_fts WHERE id IN (:ids)")
    abstract suspend fun deleteFts(ids: List<String>)

    @Query("SELECT id FROM opportunities WHERE id IN (:ids) AND id NOT IN (SELECT opportunityId FROM saved)")
    abstract suspend fun unsavedAmong(ids: List<String>): List<String>

    @Query("DELETE FROM opportunities WHERE id IN (:ids)")
    abstract suspend fun deleteRows(ids: List<String>)

    @Query("UPDATE opportunities SET stale = 1 WHERE id IN (:ids)")
    abstract suspend fun markStale(ids: List<String>)

    /**
     * Apply one synchronisation result atomically: either every change lands or none does, so a crash or a killed
     * process can never leave the list and its search index disagreeing. A removed listing that the person saved is kept
     * (and marked stale) instead of deleted.
     */
    @Transaction
    open suspend fun applyChanges(upserts: List<OpportunityEntity>, index: List<OpportunityFts>, removeIds: List<String>): Int {
        if (upserts.isNotEmpty()) {
            deleteFts(upserts.map { it.id })
            upsertRows(upserts)
            insertFts(index)
        }
        if (removeIds.isEmpty()) return 0
        var removed = 0
        for (chunk in removeIds.chunked(500)) {
            val deletable = unsavedAmong(chunk)
            if (deletable.isNotEmpty()) {
                deleteFts(deletable)
                deleteRows(deletable)
                removed += deletable.size
            }
            val keep = chunk - deletable.toSet()
            if (keep.isNotEmpty()) markStale(keep)
        }
        return removed
    }
}

@Dao
interface SavedDao {
    @Query("SELECT opportunityId FROM saved")
    fun observeIds(): Flow<List<String>>

    @Query("SELECT o.* FROM opportunities o INNER JOIN saved s ON s.opportunityId = o.id ORDER BY s.savedAt DESC")
    fun observeOpportunities(): Flow<List<OpportunityEntity>>

    @Query("SELECT * FROM saved WHERE opportunityId = :id")
    suspend fun get(id: String): SavedEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun save(entity: SavedEntity)

    @Query("DELETE FROM saved WHERE opportunityId = :id")
    suspend fun remove(id: String)

    @Query("SELECT o.id AS id, o.title AS title, o.deadline AS deadline, s.reminderDays AS reminderDays FROM saved s INNER JOIN opportunities o ON o.id = s.opportunityId WHERE o.deadline IS NOT NULL")
    suspend fun withDeadlines(): List<SavedDeadline>

    @Query("UPDATE saved SET reminderDays = :reminderDays")
    suspend fun setReminderDaysForAll(reminderDays: String)
}

@Dao
interface SyncStateDao {
    @Query("SELECT * FROM sync_state WHERE id = 1")
    suspend fun get(): SyncStateEntity?

    @Query("SELECT * FROM sync_state WHERE id = 1")
    fun observe(): Flow<SyncStateEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun put(entity: SyncStateEntity)
}

@Dao
interface DocumentDao {
    @Query("SELECT * FROM cached_documents WHERE `key` = :key")
    suspend fun get(key: String): CachedDocumentEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun put(entity: CachedDocumentEntity)

    @Query("DELETE FROM cached_documents")
    suspend fun clear()
}

@Dao
interface NotificationLogDao {
    @Query("SELECT COUNT(*) FROM notification_log WHERE `key` = :key")
    suspend fun count(key: String): Int

    @Query("SELECT `key` FROM notification_log")
    suspend fun keys(): List<String>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(entity: NotificationLogEntity)

    @Query("DELETE FROM notification_log WHERE sentAt < :before")
    suspend fun prune(before: Long)
}
