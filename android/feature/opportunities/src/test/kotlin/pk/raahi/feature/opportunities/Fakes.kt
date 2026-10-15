package pk.raahi.feature.opportunities

import java.time.Instant
import java.time.LocalDate
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import pk.raahi.core.data.OpportunityRepository
import pk.raahi.core.data.Settings
import pk.raahi.core.data.SettingsStore
import pk.raahi.core.data.SyncOutcome
import pk.raahi.core.data.SyncState
import pk.raahi.core.model.Opportunity
import pk.raahi.core.model.OpportunityFilter
import pk.raahi.core.model.OpportunityKind
import pk.raahi.core.model.Scope

internal val NOW: Instant = Instant.parse("2026-10-15T08:00:00Z")

internal fun opportunity(
    id: String,
    title: String = "Title $id",
    kind: OpportunityKind = OpportunityKind.SCHOLARSHIP,
    deadline: String? = null,
    openToPakistan: Boolean? = null,
    stale: Boolean = false,
) = Opportunity(
    id = id, rev = "000000000000", kind = kind, scope = Scope.INTERNATIONAL, title = title, organization = "Org $id", country = "Germany",
    url = "https://example.org/$id", sourceId = "src", sourceName = "Source", sourceUrl = "https://example.org",
    deadline = deadline?.let(LocalDate::parse), firstSeen = NOW.minusSeconds(30 * 86_400), lastSeen = NOW, openToPakistan = openToPakistan, stale = stale,
)

internal class FakeOpportunityRepository(items: List<Opportunity> = emptyList()) : OpportunityRepository {
    val store = MutableStateFlow(items)
    val saved = MutableStateFlow<Set<String>>(emptySet())
    val syncState = MutableStateFlow(SyncState())
    val observed = mutableListOf<Pair<OpportunityFilter, LocalDate>>()
    val setSavedCalls = mutableListOf<Triple<String, Boolean, Set<Int>>>()
    var refreshResult: SyncOutcome = SyncOutcome.UpToDate
    var refreshCalls = 0
    var refreshGate: CompletableDeferred<Unit>? = null

    override fun observe(filter: OpportunityFilter, today: LocalDate): Flow<List<Opportunity>> =
        store.map { all -> all.filter { filter.kinds.isEmpty() || it.kind in filter.kinds } }.onStart { observed += filter to today }

    override fun observeById(id: String): Flow<Opportunity?> = store.map { all -> all.firstOrNull { it.id == id } }

    override fun observeCount(): Flow<Int> = store.map { it.size }

    override fun observeSavedIds(): Flow<Set<String>> = saved

    override fun observeSaved(): Flow<List<Opportunity>> = store.map { all -> all.filter { it.id in saved.value } }

    override fun observeSyncState(): Flow<SyncState> = syncState

    override suspend fun setSaved(id: String, save: Boolean, reminderDays: Set<Int>) {
        setSavedCalls += Triple(id, save, reminderDays)
        saved.value = if (save) saved.value + id else saved.value - id
    }

    override suspend fun setReminderDays(reminderDays: Set<Int>) = Unit

    override suspend fun refresh(): SyncOutcome {
        refreshCalls += 1
        refreshGate?.await()
        return refreshResult
    }
}

internal class FakeSettings(initial: Settings = Settings()) : SettingsStore {
    val state = MutableStateFlow(initial)
    override val settings: Flow<Settings> = state

    override suspend fun update(transform: (Settings) -> Settings) {
        state.value = transform(state.value)
    }

    override suspend fun installId(): String = "11111111-2222-4333-8444-555555555555"
}
