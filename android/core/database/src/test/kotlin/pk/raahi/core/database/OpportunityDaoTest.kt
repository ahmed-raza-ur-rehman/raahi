package pk.raahi.core.database

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.time.LocalDate
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import pk.raahi.core.model.Funding
import pk.raahi.core.model.Level
import pk.raahi.core.model.OpportunityFilter
import pk.raahi.core.model.OpportunityKind
import pk.raahi.core.model.Scope

@RunWith(AndroidJUnit4::class)
@Config(sdk = [35])
class OpportunityDaoTest {
    private lateinit var db: RaahiDatabase
    private val today = LocalDate.parse("2026-10-15")

    @BeforeTest
    fun open() {
        db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext<Context>(), RaahiDatabase::class.java).allowMainThreadQueries().build()
    }

    @AfterTest
    fun close() = db.close()

    private suspend fun load(vararg items: OpportunityEntity) = db.opportunities().applyChanges(items.toList(), items.map { it.toFts() }, emptyList())

    private suspend fun ids(filter: OpportunityFilter) = db.opportunities().observe(OpportunityQueryBuilder.build(filter, today)).first().map { it.id }.sorted()

    @Test
    fun `REQ-AND-001 full-text search finds Latin and Urdu text and ranks nothing it should not`() = runBlocking {
        load(
            entity("a", title = "Chevening Scholarships for Pakistan", organization = "FCDO", country = "United Kingdom"),
            entity("b", title = "DAAD fully funded masters", summary = "Germany", country = "Germany"),
            entity("c", title = "اسکالرشپ برائے طلبہ", organization = "ایچ ای سی", country = "Pakistan"),
            entity("d", title = "Software engineer", kind = "job"),
        )
        assertEquals(listOf("a"), ids(OpportunityFilter(query = "chevening")))
        assertEquals(listOf("a"), ids(OpportunityFilter(query = "CHEV")), "prefix match, case-insensitive")
        assertEquals(listOf("b"), ids(OpportunityFilter(query = "germany funded")))
        assertEquals(listOf("c"), ids(OpportunityFilter(query = "اسکالرشپ")))
        assertEquals(listOf("c"), ids(OpportunityFilter(query = "ایچ")), "Urdu prefix")
        assertEquals(emptyList(), ids(OpportunityFilter(query = "nonexistent")))
        assertEquals(listOf("a", "b", "c", "d"), ids(OpportunityFilter()), "no query lists everything that is not a notice")
    }

    @Test
    fun `REQ-SEC-009 hostile search text is just text - it matches nothing and breaks nothing`() = runBlocking {
        load(entity("a", title = "Chevening Scholarships"), entity("b", title = "Plain listing"))
        for (hostile in listOf("'; DROP TABLE opportunities; --", "\"", "NEAR(a b, 5)", "title:chevening", "* * *", "(((", "a OR b", "\u0000", "-chevening")) {
            ids(OpportunityFilter(query = hostile))
        }
        assertEquals(2, db.opportunities().count(), "the table is intact")
        assertEquals(emptyList(), ids(OpportunityFilter(query = "title:chevening")), "the column-filter syntax has no effect: it becomes two plain words that must both match")
    }

    @Test
    fun `REQ-AND-001 filters combine - kind, scope, level, funding, openness, remote, deadlines`() = runBlocking {
        load(
            entity("open-pk", scope = "pakistan", deadline = "2026-11-01", openToPakistan = true, funding = "full", levels = ",masters,phd,"),
            entity("excluded", deadline = "2026-11-01", openToPakistan = false),
            entity("closed", deadline = "2026-10-01"),
            entity("job", kind = "job", remote = true, location = "Online", levels = ",professional,"),
            entity("notice", kind = "notice"),
            entity("soon", deadline = "2026-10-18", funding = "partial"),
        )
        assertEquals(listOf("excluded", "job", "open-pk", "soon"), ids(OpportunityFilter()), "closed listings and notices are hidden by default")
        assertEquals(listOf("closed", "excluded", "job", "open-pk", "soon"), ids(OpportunityFilter(includeClosed = true)))
        assertEquals(listOf("notice"), ids(OpportunityFilter(kinds = setOf(OpportunityKind.NOTICE))))
        assertEquals(listOf("open-pk"), ids(OpportunityFilter(scope = Scope.PAKISTAN)))
        assertEquals(listOf("open-pk"), ids(OpportunityFilter(level = Level.PHD)), "level match is exact on the comma-delimited list")
        assertEquals(listOf("open-pk"), ids(OpportunityFilter(funding = Funding.FULL)))
        assertEquals(listOf("job", "open-pk", "soon"), ids(OpportunityFilter(openToPakistanOnly = true)), "unknown openness is kept, explicit exclusion is not")
        assertEquals(listOf("job"), ids(OpportunityFilter(remoteOnly = true)))
        assertEquals(listOf("soon"), ids(OpportunityFilter(closingWithinDays = 7)))
        assertEquals(listOf("open-pk", "soon"), ids(OpportunityFilter(closingWithinDays = 30)).filter { it != "excluded" })
    }

    @Test
    fun `REQ-AND-002 a sync result is applied atomically and replaces the search index entry`() = runBlocking {
        load(entity("a", title = "Old title about chemistry"))
        db.opportunities().applyChanges(listOf(entity("a", title = "New title about physics").copy(rev = "rev-2")), listOf(entity("a", title = "New title about physics").toFts()), emptyList())
        assertEquals("rev-2", db.opportunities().getById("a")?.rev)
        assertEquals(emptyList(), ids(OpportunityFilter(query = "chemistry")), "the old words no longer match")
        assertEquals(listOf("a"), ids(OpportunityFilter(query = "physics")))
        assertEquals(1, db.opportunities().count())
    }

    @Test
    fun `REQ-AND-002 removed listings are deleted unless saved, in which case they are kept and marked stale`() = runBlocking {
        load(entity("keep-me"), entity("drop-me"), entity("gone-too"))
        db.saved().save(SavedEntity("keep-me", T0.toEpochMilli(), "7,1"))
        val removed = db.opportunities().applyChanges(emptyList(), emptyList(), listOf("keep-me", "drop-me", "gone-too", "never-existed"))
        assertEquals(2, removed)
        assertNull(db.opportunities().getById("drop-me"))
        val kept = assertNotNull(db.opportunities().getById("keep-me"))
        assertTrue(kept.stale, "a saved listing the server dropped is preserved and flagged")
        assertEquals(listOf("keep-me"), ids(OpportunityFilter(query = "Title")).filter { it == "keep-me" }, "and it is still searchable")
        assertEquals(listOf("keep-me"), db.opportunities().revisions().map { it.id })
    }

    @Test
    fun `REQ-AND-012 saving, listing and reminders work on top of the same rows`() = runBlocking {
        load(entity("a", deadline = "2026-12-01"), entity("b"), entity("c", deadline = "2026-11-20"))
        db.saved().save(SavedEntity("a", 1_000, "7,1"))
        db.saved().save(SavedEntity("c", 2_000, "3"))
        assertEquals(listOf("c", "a"), db.saved().observeOpportunities().first().map { it.id }, "most recently saved first")
        assertEquals(setOf("a", "c"), db.saved().observeIds().first().toSet())
        assertEquals(setOf("a" to "7,1", "c" to "3"), db.saved().withDeadlines().map { it.id to it.reminderDays }.toSet())
        db.saved().remove("a")
        assertNull(db.saved().get("a"))
        db.saved().setReminderDaysForAll("14")
        assertEquals("14", db.saved().get("c")?.reminderDays)
    }

    @Test
    fun `REQ-AND-001 revisions, sync state, cached documents and the notification log round-trip`() = runBlocking {
        load(entity("a"), entity("b"))
        assertEquals(mapOf("a" to "rev-a", "b" to "rev-b"), db.opportunities().revisions().associate { it.id to it.rev })
        assertNull(db.syncState().get())
        db.syncState().put(SyncStateEntity(manifestEtag = "W/\"x\"", dataVersion = "v1", lastAttemptAt = 1, lastSuccessAt = 1, lastError = null))
        assertEquals("W/\"x\"", db.syncState().get()?.manifestEtag)
        db.documents().put(CachedDocumentEntity("programmes:en", "{}", 5))
        assertEquals("{}", db.documents().get("programmes:en")?.json)
        db.notificationLog().insert(NotificationLogEntity("a:7:2026-12-01", 10))
        db.notificationLog().insert(NotificationLogEntity("a:7:2026-12-01", 20))
        assertEquals(1, db.notificationLog().count("a:7:2026-12-01"), "a duplicate insert is ignored")
        db.notificationLog().prune(15)
        assertEquals(0, db.notificationLog().count("a:7:2026-12-01"))
    }
}
