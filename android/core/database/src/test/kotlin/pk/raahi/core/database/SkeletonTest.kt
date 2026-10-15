package pk.raahi.core.database

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import kotlin.test.assertEquals

@RunWith(AndroidJUnit4::class)
@Config(sdk = [35])
class SkeletonTest {
    @Test
    fun roundTrip() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val db = Room.inMemoryDatabaseBuilder(context, SkeletonDatabase::class.java).allowMainThreadQueries().build()
        db.dao().upsert(SkeletonEntity("a", "Alpha"))
        assertEquals(listOf("Alpha"), db.dao().all().map { it.title })
        db.close()
    }
}
