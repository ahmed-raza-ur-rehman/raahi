package pk.raahi.feature.opportunities

import app.cash.turbine.test
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import pk.raahi.core.data.Settings
import pk.raahi.core.data.SyncOutcome
import pk.raahi.core.data.TimeSource
import pk.raahi.core.model.OpportunityKind
import pk.raahi.core.model.SortOrder
import pk.raahi.core.network.ApiError

@OptIn(ExperimentalCoroutinesApi::class)
class OpportunitiesViewModelTest {
    private val clock = TimeSource { NOW }

    @BeforeTest
    fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @AfterTest
    fun tearDown() = Dispatchers.resetMain()

    private fun viewModel(repo: FakeOpportunityRepository, settings: FakeSettings = FakeSettings()) = OpportunitiesViewModel(repo, settings, clock)

    @Test
    fun `REQ-AND-001 the list is empty-then-loaded without flashing an empty state and follows filter changes`() = runTest {
        val repo = FakeOpportunityRepository(listOf(opportunity("a"), opportunity("b", kind = OpportunityKind.JOB)))
        val vm = viewModel(repo)
        vm.state.test {
            var latest = awaitItem()
            while (latest.items == null || latest.items?.size != 2) latest = awaitItem()
            assertEquals(2, latest.items?.size)

            vm.onFilterChange { it.copy(kinds = setOf(OpportunityKind.JOB)) }
            while (latest.items?.map { it.id } != listOf("b")) latest = awaitItem()
            assertEquals(setOf(OpportunityKind.JOB), latest.filter.kinds)
            cancelAndIgnoreRemainingEvents()
        }
        assertTrue(repo.observed.any { it.second.toString() == "2026-10-15" }, "queries are made for today's date in Pakistan")
    }

    @Test
    fun `REQ-AND-001 clearing filters keeps the chosen sort order`() = runTest {
        val vm = viewModel(FakeOpportunityRepository(listOf(opportunity("a"))))
        vm.state.test {
            awaitItem()
            vm.onFilterChange { it.copy(sort = SortOrder.DEADLINE, kinds = setOf(OpportunityKind.JOB), openToPakistanOnly = true) }
            vm.onQueryChange("chevening")
            vm.clearFilters()
            var latest = awaitItem()
            while (latest.filter.hasActiveFilters || latest.filter.sort != SortOrder.DEADLINE) latest = awaitItem()
            assertEquals(SortOrder.DEADLINE, latest.filter.sort)
            assertEquals(setOf<OpportunityKind>(), latest.filter.kinds)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `REQ-AND-001 over-long search text is cut to a sane length`() = runTest {
        val vm = viewModel(FakeOpportunityRepository())
        vm.state.test {
            awaitItem()
            vm.onQueryChange("x".repeat(5_000))
            var latest = awaitItem()
            while (latest.filter.query.isEmpty()) latest = awaitItem()
            assertEquals(200, latest.filter.query.length)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `REQ-AND-002 the first launch fetches automatically when nothing is stored, and does not when data exists`() = runTest {
        val empty = FakeOpportunityRepository()
        viewModel(empty)
        assertEquals(1, empty.refreshCalls)

        val populated = FakeOpportunityRepository(listOf(opportunity("a")))
        viewModel(populated)
        assertEquals(0, populated.refreshCalls)
    }

    @Test
    fun `REQ-AND-004 a refresh reports what happened as a one-off message and never overlaps itself`() = runTest {
        val repo = FakeOpportunityRepository(listOf(opportunity("a")))
        val vm = viewModel(repo)
        vm.messages.test {
            repo.refreshResult = SyncOutcome.Updated(1, 0, 0, 0)
            vm.refresh()
            assertEquals(SyncMessage.UPDATED, awaitItem())

            repo.refreshResult = SyncOutcome.Failed(ApiError.Offline)
            vm.refresh()
            assertEquals(SyncMessage.OFFLINE, awaitItem())

            repo.refreshResult = SyncOutcome.Failed(ApiError.RateLimited(5))
            vm.refresh()
            assertEquals(SyncMessage.RATE_LIMITED, awaitItem())

            repo.refreshResult = SyncOutcome.UpdateRequired("2.0.0")
            vm.refresh()
            assertEquals(SyncMessage.UPDATE_REQUIRED, awaitItem())

            repo.refreshResult = SyncOutcome.Failed(ApiError.Server(500))
            vm.refresh()
            assertEquals(SyncMessage.FAILED, awaitItem())
            cancelAndIgnoreRemainingEvents()
        }

        val gate = CompletableDeferred<Unit>()
        repo.refreshGate = gate
        val before = repo.refreshCalls
        vm.refresh()
        vm.refresh()
        vm.refresh()
        assertEquals(before + 1, repo.refreshCalls, "a refresh already in flight is not started again")
        gate.complete(Unit)
    }

    @Test
    fun `REQ-AND-012 saving uses the reminder days from settings, and tapping again removes it`() = runTest {
        val repo = FakeOpportunityRepository(listOf(opportunity("a")))
        val vm = viewModel(repo, FakeSettings(Settings(reminderDays = setOf(14, 3))))
        vm.state.test {
            awaitItem()
            vm.toggleSaved("a")
            var latest = awaitItem()
            while ("a" !in latest.savedIds) latest = awaitItem()
            assertEquals(Triple("a", true, setOf(14, 3)), repo.setSavedCalls.last())
            vm.toggleSaved("a")
            while ("a" in latest.savedIds) latest = awaitItem()
            assertEquals("a", repo.setSavedCalls.last().first)
            assertEquals(false, repo.setSavedCalls.last().second)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `REQ-AND-001 the detail screen goes Loading, then Content, and says NotFound for an id that is gone`() = runTest {
        val repo = FakeOpportunityRepository(listOf(opportunity("a")))
        val found = DetailViewModel("a", repo, FakeSettings())
        found.state.test {
            var latest = awaitItem()
            while (latest !is DetailUiState.Content) latest = awaitItem()
            assertEquals("a", latest.item.id)
            assertEquals(false, latest.saved)
            found.toggleSaved()
            while (!(latest as DetailUiState.Content).saved) latest = awaitItem()
            assertEquals(Triple("a", true, setOf(7, 1)), repo.setSavedCalls.last())
            cancelAndIgnoreRemainingEvents()
        }
        val missing = DetailViewModel("zzz", repo, FakeSettings())
        missing.state.test {
            var latest = awaitItem()
            while (latest is DetailUiState.Loading) latest = awaitItem()
            assertIs<DetailUiState.NotFound>(latest)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `REQ-AND-012 the saved list follows the saved ids and un-saving removes an entry`() = runTest {
        val repo = FakeOpportunityRepository(listOf(opportunity("a"), opportunity("b")))
        repo.saved.value = setOf("a")
        val vm = SavedViewModel(repo)
        vm.state.test {
            var latest = awaitItem()
            while (latest !is SavedUiState.Content) latest = awaitItem()
            assertEquals(listOf("a"), latest.items.map { it.id })
            vm.unsave("a")
            while (!(latest is SavedUiState.Content && latest.items.isEmpty())) latest = awaitItem()
            assertNull(repo.setSavedCalls.last().third.firstOrNull())
            cancelAndIgnoreRemainingEvents()
        }
    }
}
