package pk.raahi.feature.planner

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import pk.raahi.core.data.DocState
import pk.raahi.core.data.DocumentSource
import pk.raahi.core.network.GuideDetailResponseDto
import pk.raahi.core.network.GuideListDto
import pk.raahi.core.network.ProgrammeDto
import pk.raahi.core.network.ProgrammeListDto
import pk.raahi.core.network.ResourceListDto

/** The planner's sections, mirroring the website: act now, opening soon, start preparing, later. */
data class ProgrammeGroups(
    val act: List<ProgrammeDto>,
    val soon: List<ProgrammeDto>,
    val prepare: List<ProgrammeDto>,
    val later: List<ProgrammeDto>,
) {
    val isEmpty: Boolean get() = act.isEmpty() && soon.isEmpty() && prepare.isEmpty() && later.isEmpty()
}

private val ActPhases = setOf("closing-soon", "open", "typically-open")

/** Groups by phase, keeping the server's urgency order inside each group. */
fun groupProgrammes(programmes: List<ProgrammeDto>): ProgrammeGroups {
    val act = programmes.filter { it.phase in ActPhases }
    val soon = programmes.filter { it.phase == "upcoming" }
    val rest = programmes - act.toSet() - soon.toSet()
    val prepare = rest.filter { it.prepareNow }
    return ProgrammeGroups(act, soon, prepare, rest - prepare.toSet())
}

/** Case-insensitive match on what a person would type: the name, the provider or the summary. */
fun filterProgrammes(programmes: List<ProgrammeDto>, query: String): List<ProgrammeDto> {
    val needle = query.trim().lowercase()
    if (needle.isEmpty()) return programmes
    return programmes.filter { listOf(it.title, it.provider, it.summary).any { text -> text.lowercase().contains(needle) } }
}

/**
 * Programmes, guides and the official-links directory. Content comes from [DocumentSource] (cached copy first, refreshed
 * in the background) in the language the app is currently showing.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class LearnViewModel(private val documents: DocumentSource, languageTag: Flow<String>) : ViewModel() {
    private val reload = MutableStateFlow(0)
    private val query = MutableStateFlow("")
    private val language: Flow<String> = combine(languageTag.distinctUntilChanged(), reload) { tag, _ -> tag }

    val searchQuery: StateFlow<String> = query

    val programmes: StateFlow<DocState<ProgrammeListDto>> =
        language.flatMapLatest { documents.programmes(it) }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), DocState(loading = true))

    val guides: StateFlow<DocState<GuideListDto>> =
        language.flatMapLatest { documents.guides(it) }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), DocState(loading = true))

    val resources: StateFlow<DocState<ResourceListDto>> =
        language.flatMapLatest { documents.resources(it) }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), DocState(loading = true))

    fun onQueryChange(text: String) {
        query.value = text.take(100)
    }

    fun retry() {
        reload.value += 1
    }

    class Factory(private val documents: DocumentSource, private val languageTag: Flow<String>) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = LearnViewModel(documents, languageTag) as T
    }
}

class GuideDetailViewModel(id: String, documents: DocumentSource, languageTag: Flow<String>) : ViewModel() {
    @OptIn(ExperimentalCoroutinesApi::class)
    val state: StateFlow<DocState<GuideDetailResponseDto>> =
        languageTag.distinctUntilChanged().flatMapLatest { documents.guide(id, it) }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), DocState(loading = true))

    class Factory(private val id: String, private val documents: DocumentSource, private val languageTag: Flow<String>) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = GuideDetailViewModel(id, documents, languageTag) as T
    }
}
