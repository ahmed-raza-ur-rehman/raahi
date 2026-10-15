package pk.raahi.core.data

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest
import pk.raahi.core.model.SemVer
import pk.raahi.core.network.ApiError
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import pk.raahi.core.network.OpportunityDto
import pk.raahi.core.testing.Fixtures

class SyncEngineTest {
    private val api = FakeRaahiApi(fixtureItems(1))
    private val store = InMemoryStore()
    private val state = InMemorySyncState()
    private fun engine(version: String = "1.0.0") = SyncEngine(api, store, state, { NOW }, SemVer.parse(version)!!)
    private fun revisions(items: List<OpportunityDto>) = items.associate { it.id to it.rev }

    private fun synthetic(count: Int): List<OpportunityDto> = fixtureItems(1).first().let { template -> List(count) { template.copy(id = "gen-%04d-0123456789".format(it), rev = "%012x".format(it + 1)) } }

    @Test
    fun `[REQ-AND-002] the first sync downloads everything and stores exactly the server's revisions`() = runTest {
        val outcome = engine().sync()
        assertEquals(12, assertIs<SyncOutcome.Updated>(outcome).added)
        assertEquals(revisions(fixtureItems(1)), store.revisions())
        assertNotNull(state.current.manifestEtag)
        assertEquals(NOW, state.current.lastSuccessAt)
        assertNull(state.current.lastError)
    }

    @Test
    fun `[REQ-AND-002] a second sync is a single conditional request and changes nothing (idempotent)`() = runTest {
        engine().sync()
        val batchesBefore = api.batches.size
        assertEquals(SyncOutcome.UpToDate, engine().sync())
        assertEquals(batchesBefore, api.batches.size, "no item was fetched again")
        assertEquals(revisions(fixtureItems(1)), store.revisions())
    }

    @Test
    fun `[REQ-API-009] v1 to v2 applies exactly the documented changes and converges to the server state`() = runTest {
        engine().sync()
        api.publish(fixtureItems(2))
        val outcome = assertIs<SyncOutcome.Updated>(engine().sync())
        assertEquals(1, outcome.added)
        assertEquals(2, outcome.changed)
        assertEquals(2, outcome.removed)
        assertEquals(revisions(fixtureItems(2)), store.revisions())
        val scenario = Json.parseToJsonElement(Fixtures.text("sync/README.json")).jsonObject
        val removedIds = scenario.getValue("removedIds").jsonArray.map { it.jsonPrimitive.content }.toSet()
        assertEquals(removedIds, store.removals.last().toSet())
        assertTrue(api.batches.last().size == 3, "only the 3 new or changed ids were downloaded, not the 8 unchanged ones")
        assertEquals(SyncOutcome.UpToDate, engine().sync(), "and the next sync is a no-op again")
    }

    @Test
    fun `[REQ-AND-002] an interrupted sync changes nothing and the next attempt converges (crash-safe, resumable)`() = runTest {
        api.publish(synthetic(120))
        api.failBatchNumber = 2
        val failed = assertIs<SyncOutcome.Failed>(engine().sync())
        assertEquals(ApiError.Server(503), failed.error)
        assertTrue(store.items.isEmpty(), "nothing is applied until every batch has arrived")
        assertNull(state.current.manifestEtag, "the manifest is not remembered, so the next sync repeats the diff")
        assertEquals("server error 503", state.current.lastError)

        api.failBatchNumber = null
        assertIs<SyncOutcome.Updated>(engine().sync())
        assertEquals(120, store.items.size)
        assertEquals(listOf(20, 50, 50), api.batches.takeLast(3).map { it.size }.sorted(), "120 ids go out as 50 + 50 + 20")
        assertTrue(api.batches.all { it.size <= 50 })
    }

    @Test
    fun `[REQ-AND-002] a crash while applying leaves the stored data and the sync state untouched`() = runTest {
        engine().sync()
        api.publish(fixtureItems(2))
        store.failNextApply = true
        assertFailsWith<IllegalStateException> { engine().sync() }
        assertEquals(revisions(fixtureItems(1)), store.revisions(), "the store still holds the consistent v1 data")
        assertEquals("W/\"v1\"", state.current.manifestEtag, "so the next sync still sees a difference")
        assertIs<SyncOutcome.Updated>(engine().sync())
        assertEquals(revisions(fixtureItems(2)), store.revisions())
    }

    @Test
    fun `[REQ-AND-002] one malformed record is skipped, the rest are stored, and the sync is retried in full next time`() = runTest {
        val broken = fixtureItems(1).first().copy(deadline = "2026-13-45")
        api.publish(listOf(broken) + fixtureItems(1).drop(1))
        val outcome = assertIs<SyncOutcome.Updated>(engine().sync())
        assertEquals(1, outcome.skipped)
        assertEquals(11, store.items.size)
        assertNull(state.current.manifestEtag, "an incomplete sync is not marked complete")
        assertNull(store.items[broken.id])
    }

    @Test
    fun `[REQ-AND-002] an item the manifest did not announce is never stored`() = runTest {
        val stray = fixtureItems(1).first().copy(id = "stray-0123456789")
        val rogue = object : pk.raahi.core.network.RaahiApi by api {
            override suspend fun batch(ids: List<String>) = (api.batch(ids) as pk.raahi.core.network.ApiResult.Success).let { ok -> pk.raahi.core.network.ApiResult.Success(ok.value.copy(data = ok.value.data + stray), ok.etag) }
        }
        SyncEngine(rogue, store, state, { NOW }, SemVer(1, 0, 0)).sync()
        assertNull(store.items["stray-0123456789"])
        assertEquals(12, store.items.size)
    }

    @Test
    fun `[REQ-AND-009] a server that demands a newer app stops the sync before any data is touched`() = runTest {
        api.minimumClient = "2.0.0"
        val outcome = engine("1.4.0").sync()
        assertEquals(SyncOutcome.UpdateRequired("2.0.0"), outcome)
        assertEquals(0, api.manifestCalls)
        assertTrue(store.items.isEmpty())
        assertEquals("update required", state.current.lastError)
        assertIs<SyncOutcome.Updated>(engine("2.0.0").sync(), "the current version passes the gate")
    }

    @Test
    fun `[REQ-AND-004] the update gate is advisory: if meta cannot be reached the sync still proceeds`() = runTest {
        api.metaFails = true
        assertIs<SyncOutcome.Updated>(engine().sync())
    }

    @Test
    fun `[REQ-AND-004] network failures are reported with the cause and recorded, without losing the previous good state`() = runTest {
        engine().sync()
        val goodTag = state.current.manifestEtag
        api.manifestFails = ApiError.Offline
        assertEquals(SyncOutcome.Failed(ApiError.Offline), engine().sync())
        assertEquals("offline", state.current.lastError)
        assertEquals(goodTag, state.current.manifestEtag, "the last good ETag survives a failed attempt")
        assertEquals(NOW, state.current.lastSuccessAt)
    }

    @Test
    fun `[REQ-AND-002] ids the server reports as missing are removed locally`() = runTest {
        engine().sync()
        val vanished = fixtureItems(1)[3]
        val flaky = object : pk.raahi.core.network.RaahiApi by api {
            override suspend fun manifest(ifNoneMatch: String?) = pk.raahi.core.network.ApiResult.Success(
                pk.raahi.core.network.ManifestResponseDto(
                    api.world.map { pk.raahi.core.network.ManifestEntryDto(it.id, if (it.id == vanished.id) "ffffffffffff" else it.rev) },
                    pk.raahi.core.network.ManifestMetaDto(null, "dvX", api.world.size),
                ),
                "W/\"raced\"",
            )
            override suspend fun batch(ids: List<String>) = pk.raahi.core.network.ApiResult.Success(pk.raahi.core.network.BatchResponseDto(emptyList(), ids, pk.raahi.core.network.MetaDto(null, "dvX")))
        }
        SyncEngine(flaky, store, state, { NOW }, SemVer(1, 0, 0)).sync()
        assertNull(store.items[vanished.id], "listed in the manifest but gone by the time of the batch call: treat as removed")
    }
}
