package pk.raahi.feature.opportunities

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.time.Instant
import pk.raahi.core.designsystem.EmptyState
import pk.raahi.core.designsystem.LoadingBox
import pk.raahi.core.designsystem.OpportunityCard

@Composable
fun SavedRoute(viewModel: SavedViewModel, onOpen: (String) -> Unit, modifier: Modifier = Modifier) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    SavedScreen(state, onOpen, viewModel::unsave, modifier)
}

@Composable
fun SavedScreen(state: SavedUiState, onOpen: (String) -> Unit, onUnsave: (String) -> Unit, modifier: Modifier = Modifier) {
    when (state) {
        SavedUiState.Loading -> LoadingBox(modifier)
        is SavedUiState.Content -> if (state.items.isEmpty()) {
            EmptyState(stringResource(R.string.saved_empty_title), stringResource(R.string.saved_empty_body), modifier)
        } else {
            val now = Instant.now()
            Column(modifier.fillMaxSize()) {
                LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(state.items, key = { it.id }) { item ->
                        OpportunityCard(
                            model = item.toCardModel(now, saved = true),
                            saveLabel = stringResource(R.string.detail_save),
                            unsaveLabel = stringResource(R.string.detail_unsave),
                            onClick = { onOpen(item.id) },
                            onToggleSaved = { onUnsave(item.id) },
                        )
                    }
                }
            }
        }
    }
}
