package pk.raahi.core.database

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase

@Entity(tableName = "skeleton")
data class SkeletonEntity(@PrimaryKey val id: String, val title: String)

@Dao
interface SkeletonDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: SkeletonEntity)

    @Query("SELECT * FROM skeleton ORDER BY id")
    suspend fun all(): List<SkeletonEntity>
}

@Database(entities = [SkeletonEntity::class], version = 1, exportSchema = true)
abstract class SkeletonDatabase : RoomDatabase() {
    abstract fun dao(): SkeletonDao
}
