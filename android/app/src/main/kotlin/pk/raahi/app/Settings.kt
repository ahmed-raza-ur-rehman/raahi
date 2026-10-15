package pk.raahi.app

import android.Manifest
import android.os.Build
import android.text.format.DateUtils
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import pk.raahi.core.data.AppLanguage
import pk.raahi.core.data.OpportunityRepository
import pk.raahi.core.data.Settings
import pk.raahi.core.data.SettingsStore
import pk.raahi.core.data.SyncState
import pk.raahi.core.designsystem.Banner
import pk.raahi.core.designsystem.SectionHeader
import pk.raahi.core.designsystem.Tone

data class SettingsUiState(
    val settings: Settings = Settings(),
    val syncState: SyncState = SyncState(),
    val syncing: Boolean = false,
    val storedCount: Int = 0,
)

class SettingsViewModel(private val store: SettingsStore, private val repository: OpportunityRepository) : ViewModel() {
    private val syncing = MutableStateFlow(false)

    val state: StateFlow<SettingsUiState> =
        combine(store.settings, repository.observeSyncState(), syncing, repository.observeCount()) { settings, sync, busy, count -> SettingsUiState(settings, sync, busy, count) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SettingsUiState())

    fun setLanguage(language: AppLanguage) = viewModelScope.launch { store.update { it.copy(language = language) } }

    fun setNotifications(enabled: Boolean) = viewModelScope.launch { store.update { it.copy(notificationsEnabled = enabled) } }

    fun setDataSaver(enabled: Boolean) = viewModelScope.launch { store.update { it.copy(dataSaver = enabled) } }

    fun toggleReminderDay(day: Int) {
        viewModelScope.launch {
            store.update { it.copy(reminderDays = if (day in it.reminderDays) it.reminderDays - day else it.reminderDays + day) }
            repository.setReminderDays(store.settings.first().reminderDays)
        }
    }

    fun syncNow() {
        if (syncing.value) return
        viewModelScope.launch {
            syncing.value = true
            try {
                repository.refresh()
            } finally {
                syncing.value = false
            }
        }
    }

    class Factory(private val store: SettingsStore, private val repository: OpportunityRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = SettingsViewModel(store, repository) as T
    }
}

private val ReminderChoices = listOf(14, 7, 3, 1)

@Composable
fun SettingsRoute(viewModel: SettingsViewModel, onOpenLink: (String) -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    SettingsScreen(state, viewModel::setLanguage, viewModel::setNotifications, viewModel::toggleReminderDay, viewModel::setDataSaver, viewModel::syncNow, onOpenLink)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SettingsScreen(
    state: SettingsUiState,
    onLanguage: (AppLanguage) -> Unit,
    onNotifications: (Boolean) -> Unit,
    onReminderDay: (Int) -> Unit,
    onDataSaver: (Boolean) -> Unit,
    onSyncNow: () -> Unit,
    onOpenLink: (String) -> Unit,
) {
    val context = LocalContext.current
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted -> onNotifications(granted) }
    val needsPermission = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(stringResource(R.string.settings_language))
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(8.dp)) {
                listOf(AppLanguage.SYSTEM to R.string.lang_system, AppLanguage.ENGLISH to R.string.lang_english, AppLanguage.URDU to R.string.lang_urdu).forEach { (language, label) ->
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = 48.dp).selectable(selected = state.settings.language == language, role = Role.RadioButton, onClick = { onLanguage(language) }),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(selected = state.settings.language == language, onClick = null, modifier = Modifier.padding(horizontal = 8.dp))
                        Text(stringResource(label), style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
        }

        SectionHeader(stringResource(R.string.settings_notifications))
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 48.dp).toggleable(
                        value = state.settings.notificationsEnabled,
                        role = Role.Switch,
                        onValueChange = { enabled -> if (enabled && needsPermission) permission.launch(Manifest.permission.POST_NOTIFICATIONS) else onNotifications(enabled) },
                    ),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(stringResource(R.string.settings_notifications_body), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                    Switch(checked = state.settings.notificationsEnabled, onCheckedChange = null)
                }
                Text(stringResource(R.string.settings_reminder_days), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ReminderChoices.forEach { day ->
                        FilterChip(selected = day in state.settings.reminderDays, onClick = { onReminderDay(day) }, label = { Text(pluralStringResource(R.plurals.reminder_days_chip, day, day)) })
                    }
                }
            }
        }

        SectionHeader(stringResource(R.string.settings_sync))
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 48.dp).toggleable(value = state.settings.dataSaver, role = Role.Switch, onValueChange = onDataSaver),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(stringResource(R.string.settings_data_saver), style = MaterialTheme.typography.bodyLarge)
                        Text(stringResource(R.string.settings_data_saver_body), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Switch(checked = state.settings.dataSaver, onCheckedChange = null)
                }
                val last = state.syncState.lastSuccessAt
                Text(
                    if (last == null) stringResource(R.string.settings_sync_never)
                    else stringResource(R.string.settings_sync_last, DateUtils.getRelativeTimeSpanString(last.toEpochMilli(), System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS).toString()),
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(stringResource(R.string.settings_listings_stored, state.storedCount), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (state.syncState.lastError != null) Banner(stringResource(R.string.settings_sync_failed), Tone.Warning)
                OutlinedButton(onClick = onSyncNow, enabled = !state.syncing) { Text(stringResource(R.string.settings_sync_now)) }
            }
        }

        SectionHeader(stringResource(R.string.settings_privacy))
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(stringResource(R.string.settings_privacy_body), style = MaterialTheme.typography.bodyMedium)
                TextButton(onClick = { onOpenLink("${BuildConfig.API_BASE_URL.trimEnd('/')}/privacy") }) { Text(stringResource(R.string.settings_privacy_policy)) }
            }
        }

        SectionHeader(stringResource(R.string.settings_about))
        Text(stringResource(R.string.settings_version, BuildConfig.VERSION_NAME), style = MaterialTheme.typography.bodyMedium)
        Text(stringResource(R.string.settings_disclaimer), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
