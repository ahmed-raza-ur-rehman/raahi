package pk.raahi.feature.opportunities

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import pk.raahi.core.data.OpportunityRepository
import pk.raahi.core.data.SettingsStore
import pk.raahi.core.data.SyncOutcome
import pk.raahi.core.data.SyncState
import pk.raahi.core.data.TimeSource
import pk.raahi.core.data.todayInPakistan
import pk.raahi.core.model.Opportunity
import pk.raahi.core.model.OpportunityFilter
import pk.raahi.core.network.ApiError

/** One-off messages for the snackbar (the UI maps them to localised text). */
enum class SyncMessage { UPDATED, UP_TO_DATE, OFFLINE, FAILED, RATE_LIMITED, UPDATE_REQUIRED }

internal fun SyncOutcome.toMessage(): SyncMessage = when (this) {
    is SyncOutcome.Updated -> SyncMessage.UPDATED
    SyncOutcome.UpToDate -> SyncMessage.UP_TO_DATE
    is SyncOutcome.UpdateRequired -> SyncMessage.UPDATE_REQUIRED
    is SyncOutcome.Failed -> when (error) {
        ApiError.Offline, ApiError.Timeout -> SyncMessage.OFFLINE
        is ApiError.RateLimited -> SyncMessage.RATE_LIMITED
        else -> SyncMessage.FAILED
    }
}

data class OpportunitiesUiState(
    val filter: OpportunityFilter = OpportunityFilter(),
    /** null until the first query has answered, so the screen never flashes an empty state. */
    val items: List<Opportunity>? = null,
    val savedIds: Set<String> = emptySet(),
    val syncing: Boolean = false,
    val syncState: SyncState = SyncState(),
    /** How many listings are on the device in total (null until known). */
    val storedCount: Int? = null,
)

class OpportunitiesViewModel(
    private val repository: OpportunityRepository,
    private val settings: SettingsStore,
    clock: TimeSource,
) : ViewModel() {
    private val filter = MutableStateFlow(OpportunityFilter())
    private val syncing = MutableStateFlow(false)
    private val messageChannel = Channel<SyncMessage>(Channel.BUFFERED)

    /** Messages to show once. Delivered even if the screen is briefly not collecting. */
    val messages: Flow<SyncMessage> = messageChannel.receiveAsFlow()

    private data class Extras(val saved: Set<String>, val syncing: Boolean, val syncState: SyncState, val count: Int)

    @OptIn(ExperimentalCoroutinesApi::class)
    private val listing: Flow<List<Opportunity>?> = combine(filter, clock.todayInPakistan()) { current, today -> current to today }
        .flatMapLatest { (current, today) -> repository.observe(current, today) }
        .map<List<Opportunity>, List<Opportunity>?> { it }
        .onStart { emit(null) }

    private val extras: Flow<Extras> = combine(repository.observeSavedIds(), syncing, repository.observeSyncState(), repository.observeCount()) { saved, isSyncing, state, count ->
        Extras(saved, isSyncing, state, count)
    }

    val state: StateFlow<OpportunitiesUiState> = combine(filter, listing, extras) { current, items, extra ->
        OpportunitiesUiState(current, items, extra.saved, extra.syncing, extra.syncState, extra.count)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), OpportunitiesUiState())

    init {
        // First launch: nothing on the device yet, so fetch it without waiting to be asked.
        viewModelScope.launch { if (repository.observeCount().first() == 0) refresh() }
    }

    fun onQueryChange(query: String) = filter.update { it.copy(query = query.take(200)) }

    fun onFilterChange(transform: (OpportunityFilter) -> OpportunityFilter) = filter.update(transform)

    fun clearFilters() = filter.update { OpportunityFilter(sort = it.sort) }

    fun toggleSaved(id: String) {
        viewModelScope.launch {
            val savedNow = id in state.value.savedIds
            repository.setSaved(id, !savedNow, settings.settings.first().reminderDays)
        }
    }

    fun refresh() {
        if (syncing.value) return
        viewModelScope.launch {
            syncing.value = true
            try {
                messageChannel.send(repository.refresh().toMessage())
            } finally {
                syncing.value = false
            }
        }
    }

    private fun <T> MutableStateFlow<T>.update(transform: (T) -> T) {
        value = transform(value)
    }

    class Factory(private val repository: OpportunityRepository, private val settings: SettingsStore, private val clock: TimeSource) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = OpportunitiesViewModel(repository, settings, clock) as T
    }
}
