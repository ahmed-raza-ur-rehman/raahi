package pk.raahi.core.database

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Fts4
import androidx.room.FtsOptions
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * One synchronised listing. Dates are ISO text (`2026-10-15`) so SQLite can compare them lexicographically; instants
 * are epoch milliseconds. Lists are stored as text: `levels` as `,masters,phd,` (so `LIKE '%,masters,%'` is exact) and
 * the free-text lists as JSON. Mapping to the domain model lives in :core:data.
 */
@Entity(tableName = "opportunities", indices = [Index("deadline"), Index("kind"), Index("firstSeen")])
data class OpportunityEntity(
    @PrimaryKey val id: String,
    val rev: String,
    val kind: String,
    val scope: String,
    val title: String,
    val organization: String?,
    val summary: String?,
    val url: String,
    val applyUrl: String?,
    val sourceId: String,
    val sourceName: String,
    val sourceUrl: String,
    val country: String?,
    val location: String?,
    val remote: Boolean?,
    val levels: String,
    val fields: String,
    val tags: String,
    val funding: String?,
    val deadline: String?,
    val deadlineText: String?,
    val rolling: Boolean,
    val postedAt: Long?,
    val startsAt: String?,
    val firstSeen: Long,
    val lastSeen: Long,
    val openToPakistan: Boolean?,
    val eligibilityNote: String?,
    val languages: String,
    val alsoOn: String,
    /** No longer listed by the server but kept because the person saved it. */
    val stale: Boolean = false,
)

/**
 * The on-device search index. A standalone FTS4 table (kept in step with `opportunities` inside the same transaction)
 * with the Unicode tokenizer, so Urdu, Pashto and Latin text are all searchable. `id` is stored but not indexed.
 */
@Entity(tableName = "opportunity_fts")
@Fts4(tokenizer = FtsOptions.TOKENIZER_UNICODE61, notIndexed = ["id"])
data class OpportunityFts(
    val id: String,
    val title: String,
    val organization: String,
    val summary: String,
    val tags: String,
    val country: String,
)

/** A bookmarked listing. `reminderDays` are the "N days before the deadline" offsets, as `7,1`. */
@Entity(tableName = "saved")
data class SavedEntity(
    @PrimaryKey val opportunityId: String,
    val savedAt: Long,
    val reminderDays: String,
)

/** The single row describing where synchronisation stands. */
@Entity(tableName = "sync_state")
data class SyncStateEntity(
    @PrimaryKey val id: Int = 1,
    val manifestEtag: String?,
    val dataVersion: String?,
    val lastAttemptAt: Long?,
    val lastSuccessAt: Long?,
    val lastError: String?,
)

/** A cached API document (programmes, guides, resources) so those screens work offline. */
@Entity(tableName = "cached_documents")
data class CachedDocumentEntity(
    @PrimaryKey @ColumnInfo(name = "key") val key: String,
    val json: String,
    val fetchedAt: Long,
)

/** Which reminders were already shown, so a worker that runs twice never notifies twice. */
@Entity(tableName = "notification_log")
data class NotificationLogEntity(
    @PrimaryKey val key: String,
    val sentAt: Long,
)

/** A saved listing with what the reminder worker needs. */
data class SavedDeadline(
    val id: String,
    val title: String,
    val deadline: String?,
    val reminderDays: String,
)

data class IdRev(val id: String, val rev: String)
