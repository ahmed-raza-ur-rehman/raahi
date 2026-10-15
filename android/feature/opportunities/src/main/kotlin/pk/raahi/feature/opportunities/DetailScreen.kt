package pk.raahi.feature.opportunities

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import pk.raahi.core.designsystem.Badge
import pk.raahi.core.designsystem.Banner
import pk.raahi.core.designsystem.BadgeModel
import pk.raahi.core.designsystem.EmptyState
import pk.raahi.core.designsystem.LoadingBox
import pk.raahi.core.designsystem.SectionHeader
import pk.raahi.core.designsystem.Tone
import pk.raahi.core.model.Opportunity
import pk.raahi.core.model.UrlPolicy
import pk.raahi.core.model.isNew
import pk.raahi.core.model.statusAt

@Composable
fun DetailRoute(viewModel: DetailViewModel, onBack: () -> Unit, onOpenLink: (String) -> Unit, onShare: (String) -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    DetailScreen(state, onBack, viewModel::toggleSaved, onOpenLink, onShare)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DetailScreen(state: DetailUiState, onBack: () -> Unit, onToggleSaved: () -> Unit, onOpenLink: (String) -> Unit, onShare: (String) -> Unit) {
    val shareText = (state as? DetailUiState.Content)?.item?.let { stringResource(R.string.detail_share_text, it.title, it.url) }
    Scaffold(
        topBar = {
            TopAppBar(
                title = {},
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.detail_back)) } },
                actions = {
                    if (state is DetailUiState.Content) {
                        IconButton(onClick = onToggleSaved) {
                            Icon(
                                if (state.saved) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                                contentDescription = stringResource(if (state.saved) R.string.detail_unsave else R.string.detail_save),
                                tint = if (state.saved) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                            )
                        }
                        if (shareText != null) {
                            IconButton(onClick = { onShare(shareText) }) { Icon(Icons.Filled.Share, contentDescription = stringResource(R.string.detail_share)) }
                        }
                    }
                },
            )
        },
    ) { padding ->
        when (state) {
            DetailUiState.Loading -> LoadingBox(Modifier.padding(padding))
            DetailUiState.NotFound -> EmptyState(stringResource(R.string.detail_not_found), null, Modifier.padding(padding))
            is DetailUiState.Content -> DetailContent(state.item, onOpenLink, Modifier.padding(padding))
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DetailContent(item: Opportunity, onOpenLink: (String) -> Unit, modifier: Modifier = Modifier) {
    val now = Instant.now()
    val locale = LocalConfiguration.current.locales[0]
    val formatter = DateTimeFormatter.ofLocalizedDate(FormatStyle.LONG).withLocale(locale)
    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(stringResource(item.kind.labelRes()), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
        Text(item.title, style = MaterialTheme.typography.headlineSmall)
        listOfNotNull(item.organization, item.country ?: item.location).joinToString(" · ").takeIf { it.isNotBlank() }?.let {
            Text(it, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Badge(BadgeModel(statusText(item.statusAt(now)), statusTone(item.statusAt(now))))
            if (isNew(item.firstSeen, now)) Badge(BadgeModel(stringResource(R.string.badge_new), Tone.Highlight))
            item.funding?.labelRes()?.let { Badge(BadgeModel(stringResource(it), Tone.Positive)) }
            when (item.openToPakistan) {
                true -> Badge(BadgeModel(stringResource(R.string.badge_open_pk), Tone.Info))
                false -> Badge(BadgeModel(stringResource(R.string.badge_excludes_pk), Tone.Danger))
                null -> Unit
            }
        }
        if (item.stale) Banner(stringResource(R.string.detail_stale), tone = Tone.Warning)

        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(stringResource(R.string.detail_deadline), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(item.deadline?.format(formatter) ?: item.deadlineText ?: stringResource(R.string.status_unknown), style = MaterialTheme.typography.titleMedium)
                Text(stringResource(R.string.detail_deadline_note), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        item.summary?.let { Text(it, style = MaterialTheme.typography.bodyLarge) }
        item.eligibilityNote?.let {
            SectionHeader(stringResource(R.string.detail_eligibility))
            Text(it, style = MaterialTheme.typography.bodyLarge)
        }

        val levelLabels = item.levels.map { stringResource(it.labelRes()) }
        val fundingLabel = item.funding?.labelRes()?.let { stringResource(it) }
        val levelTitle = stringResource(R.string.detail_level)
        val fundingTitle = stringResource(R.string.detail_funding)
        val whereTitle = stringResource(R.string.detail_where)
        val languagesTitle = stringResource(R.string.detail_languages)
        val place = listOfNotNull(item.location, item.country).distinct().joinToString(", ").takeIf { it.isNotBlank() }
        val rows = listOfNotNull(
            if (levelLabels.isNotEmpty()) levelTitle to levelLabels.joinToString(", ") else null,
            fundingLabel?.let { fundingTitle to it },
            place?.let { whereTitle to it },
            if (item.languages.isNotEmpty()) languagesTitle to item.languages.joinToString(", ") else null,
        )
        if (rows.isNotEmpty()) {
            SectionHeader(stringResource(R.string.detail_details))
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(horizontal = 16.dp)) {
                    rows.forEachIndexed { index, (label, value) ->
                        if (index > 0) HorizontalDivider()
                        Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(0.4f))
                            Text(value, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(0.6f))
                        }
                    }
                }
            }
        }

        val primaryUrl = item.applyUrl ?: item.url
        Button(onClick = { onOpenLink(primaryUrl) }, enabled = UrlPolicy.isSafeToOpen(primaryUrl), modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.detail_open_page))
        }
        if (item.applyUrl != null && item.applyUrl != item.url) {
            OutlinedButton(onClick = { onOpenLink(item.url) }, enabled = UrlPolicy.isSafeToOpen(item.url), modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.detail_source))
            }
        }

        SectionHeader(stringResource(R.string.detail_source))
        LinkText(item.sourceName, item.sourceUrl, onOpenLink)
        if (item.alsoOn.isNotEmpty()) {
            SectionHeader(stringResource(R.string.detail_also_on))
            item.alsoOn.forEach { LinkText(it.sourceName, it.url, onOpenLink) }
        }
        Text(stringResource(R.string.detail_verify), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(vertical = 8.dp))
    }
}

@Composable
private fun LinkText(text: String, url: String, onOpenLink: (String) -> Unit) {
    val safe = UrlPolicy.isSafeToOpen(url)
    Text(
        text,
        style = MaterialTheme.typography.bodyLarge,
        color = if (safe) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.minimumInteractiveComponentSize().let { if (safe) it.clickable(role = Role.Button) { onOpenLink(url) } else it },
    )
}

@Composable
private fun statusText(info: pk.raahi.core.model.StatusInfo): String = statusBadge(info).text

private fun statusTone(info: pk.raahi.core.model.StatusInfo): Tone = when (info.status) {
    pk.raahi.core.model.DeadlineStatus.OPEN -> Tone.Positive
    pk.raahi.core.model.DeadlineStatus.CLOSING_SOON -> Tone.Warning
    pk.raahi.core.model.DeadlineStatus.ROLLING -> Tone.Info
    else -> Tone.Neutral
}
