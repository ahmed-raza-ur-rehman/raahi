package pk.raahi.feature.opportunities

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import pk.raahi.core.data.OpportunityRepository
import pk.raahi.core.data.SettingsStore
import pk.raahi.core.model.Opportunity

sealed interface DetailUiState {
    data object Loading : DetailUiState

    data object NotFound : DetailUiState

    data class Content(val item: Opportunity, val saved: Boolean) : DetailUiState
}

class DetailViewModel(
    private val id: String,
    private val repository: OpportunityRepository,
    private val settings: SettingsStore,
) : ViewModel() {
    val state: StateFlow<DetailUiState> = combine(repository.observeById(id), repository.observeSavedIds()) { item, saved ->
        if (item == null) DetailUiState.NotFound else DetailUiState.Content(item, id in saved)
    }.onStart<DetailUiState> { emit(DetailUiState.Loading) }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), DetailUiState.Loading)

    fun toggleSaved() {
        val current = state.value as? DetailUiState.Content ?: return
        viewModelScope.launch { repository.setSaved(id, !current.saved, settings.settings.first().reminderDays) }
    }

    class Factory(private val id: String, private val repository: OpportunityRepository, private val settings: SettingsStore) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = DetailViewModel(id, repository, settings) as T
    }
}

sealed interface SavedUiState {
    data object Loading : SavedUiState

    data class Content(val items: List<Opportunity>) : SavedUiState
}

class SavedViewModel(private val repository: OpportunityRepository) : ViewModel() {
    private val loaded: Flow<SavedUiState> = repository.observeSaved().map { SavedUiState.Content(it) }

    val state: StateFlow<SavedUiState> = loaded.onStart<SavedUiState> { emit(SavedUiState.Loading) }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SavedUiState.Loading)

    fun unsave(id: String) {
        viewModelScope.launch { repository.setSaved(id, save = false, reminderDays = emptySet()) }
    }

    class Factory(private val repository: OpportunityRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = SavedViewModel(repository) as T
    }
}
