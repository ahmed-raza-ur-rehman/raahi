package pk.raahi.feature.opportunities

import android.text.format.DateUtils
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.time.Instant
import pk.raahi.core.designsystem.Banner
import pk.raahi.core.designsystem.EmptyState
import pk.raahi.core.designsystem.ErrorState
import pk.raahi.core.designsystem.LoadingBox
import pk.raahi.core.designsystem.OpportunityCard
import pk.raahi.core.model.Opportunity
import pk.raahi.core.model.OpportunityFilter
import pk.raahi.core.model.OpportunityKind
import pk.raahi.core.model.SortOrder

/** The kinds offered as filter chips, in the order people look for them. */
private val ChipKinds = listOf(
    OpportunityKind.SCHOLARSHIP, OpportunityKind.JOB, OpportunityKind.INTERNSHIP, OpportunityKind.FELLOWSHIP, OpportunityKind.COMPETITION,
    OpportunityKind.COURSE, OpportunityKind.COUPON, OpportunityKind.TRAINING, OpportunityKind.GRANT, OpportunityKind.ADMISSION,
)

private fun SyncMessage.textRes(): Int = when (this) {
    SyncMessage.UPDATED -> R.string.snack_updated
    SyncMessage.UP_TO_DATE -> R.string.snack_up_to_date
    SyncMessage.OFFLINE -> R.string.snack_offline
    SyncMessage.FAILED -> R.string.snack_failed
    SyncMessage.RATE_LIMITED -> R.string.snack_rate_limited
    SyncMessage.UPDATE_REQUIRED -> R.string.snack_update_required
}

/** Stateful wrapper: collects the ViewModel and turns one-off messages into snackbars. */
@Composable
fun OpportunitiesRoute(viewModel: OpportunitiesViewModel, snackbar: SnackbarHostState, onOpen: (String) -> Unit, modifier: Modifier = Modifier) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    LaunchedEffect(viewModel) { viewModel.messages.collect { snackbar.showSnackbar(context.getString(it.textRes())) } }
    OpportunitiesScreen(
        state = state,
        onQueryChange = viewModel::onQueryChange,
        onFilterChange = viewModel::onFilterChange,
        onClearFilters = viewModel::clearFilters,
        onToggleSaved = viewModel::toggleSaved,
        onRefresh = viewModel::refresh,
        onOpen = onOpen,
        modifier = modifier,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OpportunitiesScreen(
    state: OpportunitiesUiState,
    onQueryChange: (String) -> Unit,
    onFilterChange: ((OpportunityFilter) -> OpportunityFilter) -> Unit,
    onClearFilters: () -> Unit,
    onToggleSaved: (String) -> Unit,
    onRefresh: () -> Unit,
    onOpen: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxSize()) {
        SearchField(state.filter.query, onQueryChange)
        FilterRows(state.filter, onFilterChange)
        PullToRefreshBox(isRefreshing = state.syncing, onRefresh = onRefresh, modifier = Modifier.weight(1f)) {
            val items = state.items
            when {
                items == null -> LoadingBox()
                items.isEmpty() && (state.storedCount ?: 0) == 0 ->
                    if (state.syncing) EmptyState(stringResource(R.string.empty_first_sync), null)
                    else ErrorState(stringResource(R.string.error_offline_first), stringResource(R.string.action_retry), onRefresh)
                items.isEmpty() -> EmptyState(
                    stringResource(R.string.empty_no_results_title),
                    stringResource(R.string.empty_no_results_body),
                    actionLabel = stringResource(R.string.action_clear_filters),
                    onAction = onClearFilters,
                )
                else -> ListContent(items, state, onToggleSaved, onOpen)
            }
        }
    }
}

@Composable
private fun SearchField(query: String, onQueryChange: (String) -> Unit) {
    OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        placeholder = { Text(stringResource(R.string.opp_search_hint)) },
        leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
        trailingIcon = {
            if (query.isNotEmpty()) {
                IconButton(onClick = { onQueryChange("") }) { Icon(Icons.Filled.Clear, contentDescription = stringResource(R.string.opp_search_clear)) }
            }
        },
        singleLine = true,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
    )
}

@Composable
private fun FilterRows(filter: OpportunityFilter, onFilterChange: ((OpportunityFilter) -> OpportunityFilter) -> Unit) {
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            FilterChip(selected = filter.kinds.isEmpty(), onClick = { onFilterChange { it.copy(kinds = emptySet()) } }, label = { Text(stringResource(R.string.filter_all)) })
        }
        items(ChipKinds, key = { it.wire }) { kind ->
            FilterChip(
                selected = kind in filter.kinds,
                onClick = { onFilterChange { it.copy(kinds = if (kind in it.kinds) it.kinds - kind else it.kinds + kind) } },
                label = { Text(stringResource(kind.labelRes())) },
            )
        }
    }
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        item {
            FilterChip(selected = filter.openToPakistanOnly, onClick = { onFilterChange { it.copy(openToPakistanOnly = !it.openToPakistanOnly) } }, label = { Text(stringResource(R.string.filter_open_pk)) })
        }
        item {
            FilterChip(
                selected = filter.closingWithinDays != null,
                onClick = { onFilterChange { it.copy(closingWithinDays = if (it.closingWithinDays == null) 7 else null) } },
                label = { Text(stringResource(R.string.filter_closing_soon)) },
            )
        }
        item {
            FilterChip(selected = filter.includeClosed, onClick = { onFilterChange { it.copy(includeClosed = !it.includeClosed) } }, label = { Text(stringResource(R.string.filter_include_closed)) })
        }
        item { SortMenu(filter.sort) { sort -> onFilterChange { it.copy(sort = sort) } } }
    }
}

@Composable
private fun SortMenu(current: SortOrder, onSelect: (SortOrder) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        TextButton(onClick = { expanded = true }) { Text("${stringResource(R.string.sort_label)}: ${stringResource(current.labelRes())}") }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            SortOrder.entries.forEach { order ->
                DropdownMenuItem(text = { Text(stringResource(order.labelRes())) }, onClick = { expanded = false; onSelect(order) })
            }
        }
    }
}

private fun SortOrder.labelRes(): Int = when (this) {
    SortOrder.RECOMMENDED -> R.string.sort_recommended
    SortOrder.DEADLINE -> R.string.sort_deadline
    SortOrder.NEWEST -> R.string.sort_newest
}

@Composable
private fun ListContent(items: List<Opportunity>, state: OpportunitiesUiState, onToggleSaved: (String) -> Unit, onOpen: (String) -> Unit) {
    val now = Instant.now()
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxSize()) {
        item(key = "header") {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(pluralStringResource(R.plurals.opp_count, items.size, items.size), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                state.syncState.lastSuccessAt?.let { at ->
                    val relative = remember(at) { DateUtils.getRelativeTimeSpanString(at.toEpochMilli(), System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS).toString() }
                    Text(stringResource(R.string.banner_last_updated, relative), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            if (state.syncState.lastError == "update required") Banner(stringResource(R.string.snack_update_required), pk.raahi.core.designsystem.Tone.Warning, Modifier.padding(top = 8.dp))
        }
        items(items, key = { it.id }) { item ->
            OpportunityCard(
                model = item.toCardModel(now, item.id in state.savedIds),
                saveLabel = stringResource(R.string.detail_save),
                unsaveLabel = stringResource(R.string.detail_unsave),
                onClick = { onOpen(item.id) },
                onToggleSaved = { onToggleSaved(item.id) },
            )
        }
    }
}
