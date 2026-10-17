package pk.raahi.core.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        OpportunityEntity::class,
        OpportunityFts::class,
        SavedEntity::class,
        SyncStateEntity::class,
        CachedDocumentEntity::class,
        NotificationLogEntity::class,
    ],
    version = 1,
    exportSchema = true,
)
abstract class RaahiDatabase : RoomDatabase() {
    abstract fun opportunities(): OpportunityDao

    abstract fun saved(): SavedDao

    abstract fun syncState(): SyncStateDao

    abstract fun documents(): DocumentDao

    abstract fun notificationLog(): NotificationLogDao

    companion object {
        const val NAME = "raahi.db"

        /**
         * There is deliberately NO destructive fallback on upgrade: the database holds the person's saved listings, and
         * silently dropping them would be a data-loss bug. Every schema change needs an explicit, tested migration.
         * Only a downgrade (an older app over newer data) may start afresh - the data is re-synchronised from the server.
         */
        fun create(context: Context): RaahiDatabase =
            Room.databaseBuilder(context.applicationContext, RaahiDatabase::class.java, NAME)
                .fallbackToDestructiveMigrationOnDowngrade(dropAllTables = true)
                .build()
    }
}
