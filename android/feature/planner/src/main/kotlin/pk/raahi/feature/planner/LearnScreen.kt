package pk.raahi.feature.planner

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import pk.raahi.core.data.DocState
import pk.raahi.core.designsystem.Badge
import pk.raahi.core.designsystem.BadgeModel
import pk.raahi.core.designsystem.Banner
import pk.raahi.core.designsystem.EmptyState
import pk.raahi.core.designsystem.ErrorState
import pk.raahi.core.designsystem.LoadingBox
import pk.raahi.core.designsystem.SectionHeader
import pk.raahi.core.designsystem.Tone
import pk.raahi.core.model.UrlPolicy
import pk.raahi.core.network.GuideSummaryDto
import pk.raahi.core.network.ProgrammeDto
import pk.raahi.core.network.ResourceDto

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LearnRoute(viewModel: LearnViewModel, onOpenGuide: (String) -> Unit, onOpenLink: (String) -> Unit, modifier: Modifier = Modifier) {
    val programmes by viewModel.programmes.collectAsStateWithLifecycle()
    val guides by viewModel.guides.collectAsStateWithLifecycle()
    val resources by viewModel.resources.collectAsStateWithLifecycle()
    val query by viewModel.searchQuery.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableIntStateOf(0) }
    Column(modifier.fillMaxSize()) {
        PrimaryTabRow(selectedTabIndex = tab) {
            listOf(R.string.tab_programmes, R.string.tab_guides, R.string.tab_links).forEachIndexed { index, label ->
                Tab(selected = tab == index, onClick = { tab = index }, text = { Text(stringResource(label)) })
            }
        }
        when (tab) {
            0 -> ProgrammesTab(programmes, query, viewModel::onQueryChange, viewModel::retry, onOpenLink)
            1 -> GuidesTab(guides, viewModel::retry, onOpenGuide)
            else -> LinksTab(resources, viewModel::retry, onOpenLink)
        }
    }
}

@Composable
private fun StaleNote(state: DocState<*>) {
    val at = state.fetchedAt
    if (state.error != null && state.data != null && at != null) {
        val text = at.formatDate()
        Banner(stringResource(R.string.plan_offline_note, text), Tone.Warning, Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
    }
}

@Composable
private fun Instant.formatDate(): String =
    DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(LocalConfiguration.current.locales[0]).format(atZone(ZoneId.systemDefault()))

@Composable
private fun <T> DocGate(state: DocState<T>, onRetry: () -> Unit, content: @Composable (T) -> Unit) {
    val data = state.data
    when {
        data != null -> Column(Modifier.fillMaxSize()) {
            StaleNote(state)
            content(data)
        }
        state.loading -> LoadingBox()
        state.error != null -> ErrorState(stringResource(R.string.plan_load_error), stringResource(R.string.action_retry), onRetry)
        else -> EmptyState(stringResource(R.string.plan_empty_title), stringResource(R.string.plan_empty_body))
    }
}

// ─── Programmes ──────────────────────────────────────────────────────────────

@Composable
private fun ProgrammesTab(state: DocState<pk.raahi.core.network.ProgrammeListDto>, query: String, onQuery: (String) -> Unit, onRetry: () -> Unit, onOpenLink: (String) -> Unit) {
    DocGate(state, onRetry) { list ->
        val groups = groupProgrammes(filterProgrammes(list.data, query))
        var expanded by rememberSaveable { mutableStateOf<String?>(null) }
        LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxSize()) {
            item(key = "intro") {
                Text(stringResource(R.string.plan_intro), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedTextField(
                    value = query,
                    onValueChange = onQuery,
                    placeholder = { Text(stringResource(R.string.plan_search_hint)) },
                    leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                    trailingIcon = { if (query.isNotEmpty()) IconButton(onClick = { onQuery("") }) { Icon(Icons.Filled.Clear, contentDescription = stringResource(R.string.plan_search_clear)) } },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                )
            }
            if (groups.isEmpty) item(key = "none") { EmptyState(stringResource(R.string.plan_no_matches), null) }
            section(R.string.section_act, groups.act, expanded, { expanded = if (expanded == it) null else it }, onOpenLink)
            section(R.string.section_soon, groups.soon, expanded, { expanded = if (expanded == it) null else it }, onOpenLink)
            section(R.string.section_prepare, groups.prepare, expanded, { expanded = if (expanded == it) null else it }, onOpenLink)
            section(R.string.section_later, groups.later, expanded, { expanded = if (expanded == it) null else it }, onOpenLink)
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.section(
    @androidx.annotation.StringRes title: Int,
    programmes: List<ProgrammeDto>,
    expandedId: String?,
    onToggle: (String) -> Unit,
    onOpenLink: (String) -> Unit,
) {
    if (programmes.isEmpty()) return
    item(key = "h-$title") { SectionHeader(stringResource(title)) }
    items(programmes, key = { it.id }) { programme -> ProgrammeCard(programme, programme.id == expandedId, { onToggle(programme.id) }, onOpenLink) }
}

@Composable
private fun phaseBadge(programme: ProgrammeDto): BadgeModel = when (programme.phase) {
    "closing-soon" -> BadgeModel(programme.daysLeft?.let { pluralStringResource(R.plurals.days_left, it, it) } ?: stringResource(R.string.phase_closing_soon), Tone.Warning)
    "open" -> BadgeModel(stringResource(R.string.phase_open), Tone.Positive)
    "typically-open" -> BadgeModel(stringResource(R.string.phase_typically_open), Tone.Info)
    "upcoming" -> BadgeModel(stringResource(R.string.phase_upcoming), Tone.Info)
    "closed" -> BadgeModel(stringResource(R.string.phase_closed), Tone.Neutral)
    else -> BadgeModel(stringResource(R.string.phase_off_season), Tone.Neutral)
}

@Composable
private fun String.asDate(): String = runCatching {
    LocalDate.parse(this).format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(LocalConfiguration.current.locales[0]))
}.getOrDefault(this)

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ProgrammeCard(programme: ProgrammeDto, expanded: Boolean, onToggle: () -> Unit, onOpenLink: (String) -> Unit) {
    Card(onClick = onToggle, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(programme.provider, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            Text(programme.title, style = MaterialTheme.typography.titleMedium)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Badge(phaseBadge(programme))
                if (programme.prepareNow) Badge(BadgeModel(stringResource(R.string.programme_prepare_now), Tone.Highlight))
            }
            programme.cycle?.let { cycle ->
                val dateLine = cycle.closes?.let { stringResource(R.string.programme_closes, it.asDate()) } ?: cycle.opens?.let { stringResource(R.string.programme_opens, it.asDate()) }
                if (dateLine != null) Text(dateLine, style = MaterialTheme.typography.bodyLarge)
                cycle.closesNote?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                // The honesty rule: a date read on the organiser's own page is "official"; anything else says to confirm.
                val official = cycle.confidence == "official"
                Badge(BadgeModel(stringResource(if (official) R.string.confidence_official else R.string.confidence_reported), if (official) Tone.Positive else Tone.Warning))
                Text(stringResource(R.string.programme_checked, cycle.checked.asDate()), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(
                stringResource(if (expanded) R.string.programme_collapse else R.string.programme_expand),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
            )
            if (expanded) {
                Text(programme.summary, style = MaterialTheme.typography.bodyLarge)
                LabelledText(stringResource(R.string.programme_route), programme.routeNote)
                LabelledText(stringResource(R.string.programme_usual_window), programme.usualWindow)
                if (programme.prepare.isNotEmpty()) {
                    Text(stringResource(R.string.programme_prepare), style = MaterialTheme.typography.labelLarge)
                    programme.prepare.forEach { Text("• $it", style = MaterialTheme.typography.bodyMedium) }
                }
                Button(onClick = { onOpenLink(programme.official) }, enabled = UrlPolicy.isSafeToOpen(programme.official), modifier = Modifier.fillMaxWidth()) {
                    Text(stringResource(R.string.programme_official_page))
                }
            }
        }
    }
}

@Composable
private fun LabelledText(label: String, text: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(text, style = MaterialTheme.typography.bodyMedium)
    }
}

// ─── Guides ──────────────────────────────────────────────────────────────────

@Composable
private fun GuidesTab(state: DocState<pk.raahi.core.network.GuideListDto>, onRetry: () -> Unit, onOpenGuide: (String) -> Unit) {
    DocGate(state, onRetry) { list ->
        LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxSize()) {
            items(list.data, key = { it.id }) { guide -> GuideRow(guide) { onOpenGuide(guide.id) } }
        }
    }
}

@Composable
internal fun GuideRow(guide: GuideSummaryDto, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(guide.emoji, style = MaterialTheme.typography.headlineSmall)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(guide.title, style = MaterialTheme.typography.titleMedium)
                Text(guide.summary, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(stringResource(R.string.guide_steps, guide.steps) + (guide.duration?.let { " · $it" } ?: ""), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}

// ─── Official links ──────────────────────────────────────────────────────────

@Composable
private fun LinksTab(state: DocState<pk.raahi.core.network.ResourceListDto>, onRetry: () -> Unit, onOpenLink: (String) -> Unit) {
    DocGate(state, onRetry) { list ->
        LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxSize()) {
            item(key = "note") { Banner(stringResource(R.string.links_note)) }
            items(list.data.sortedWith(compareBy({ it.authority }, { it.name })), key = { it.id }) { resource -> ResourceRow(resource, onOpenLink) }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ResourceRow(resource: ResourceDto, onOpenLink: (String) -> Unit) {
    val safe = UrlPolicy.isSafeToOpen(resource.url)
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(resource.name, style = MaterialTheme.typography.titleMedium)
            Text(resource.description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (resource.authority <= 2) Badge(BadgeModel(stringResource(R.string.links_official), Tone.Positive))
                if (resource.free == true) Badge(BadgeModel(stringResource(R.string.links_free), Tone.Info))
            }
            OutlinedButton(onClick = { onOpenLink(resource.url) }, enabled = safe) { Text(stringResource(R.string.links_open)) }
        }
    }
}

// ─── Guide detail ────────────────────────────────────────────────────────────

@Composable
fun GuideDetailRoute(viewModel: GuideDetailViewModel, onBack: () -> Unit, onOpenLink: (String) -> Unit, modifier: Modifier = Modifier) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    GuideDetailScreen(state, onBack, onOpenLink, modifier)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GuideDetailScreen(state: DocState<pk.raahi.core.network.GuideDetailResponseDto>, onBack: () -> Unit, onOpenLink: (String) -> Unit, modifier: Modifier = Modifier) {
    androidx.compose.material3.Scaffold(
        modifier = modifier,
        topBar = {
            androidx.compose.material3.TopAppBar(
                title = {},
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.guide_back)) } },
            )
        },
    ) { padding ->
        val guide = state.data?.data
        when {
            guide != null -> androidx.compose.foundation.lazy.LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.padding(padding).fillMaxSize(),
            ) {
                item { Text("${guide.emoji}  ${guide.title}", style = MaterialTheme.typography.headlineSmall) }
                item { Text(guide.summary, style = MaterialTheme.typography.bodyLarge) }
                item { LabelledText(stringResource(R.string.guide_audience), guide.audience) }
                item { SectionHeader(stringResource(R.string.guide_steps_title)) }
                items(guide.steps.size) { index ->
                    val step = guide.steps[index]
                    Card(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("${index + 1}. ${step.title}", style = MaterialTheme.typography.titleMedium)
                            step.timing?.let { Text(it, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary) }
                            Text(step.body, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
                if (guide.checklist.isNotEmpty()) {
                    item { SectionHeader(stringResource(R.string.guide_checklist)) }
                    items(guide.checklist.size) { Text("✓ ${guide.checklist[it]}", style = MaterialTheme.typography.bodyMedium) }
                }
                if (guide.pitfalls.isNotEmpty()) {
                    item { SectionHeader(stringResource(R.string.guide_pitfalls)) }
                    items(guide.pitfalls.size) { Text("⚠ ${guide.pitfalls[it]}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error) }
                }
                if (guide.resources.isNotEmpty()) {
                    item { SectionHeader(stringResource(R.string.guide_resources)) }
                    items(guide.resources.size) { index ->
                        val resource = guide.resources[index]
                        val safe = UrlPolicy.isSafeToOpen(resource.url)
                        Text(
                            resource.name,
                            style = MaterialTheme.typography.bodyLarge,
                            color = if (safe) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp).let { if (safe) it.clickable(role = Role.Button) { onOpenLink(resource.url) } else it },
                        )
                    }
                }
                item { Text(stringResource(R.string.guide_reviewed, guide.reviewed), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            state.loading -> LoadingBox(Modifier.padding(padding))
            else -> EmptyState(stringResource(R.string.guide_not_found), null, Modifier.padding(padding))
        }
    }
}
