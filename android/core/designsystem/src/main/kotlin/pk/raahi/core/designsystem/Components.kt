package pk.raahi.core.designsystem

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

/** The meaning of a badge; the theme decides the colours (so dark mode and contrast are handled in one place). */
enum class Tone { Positive, Warning, Danger, Info, Neutral, Highlight }

data class BadgeModel(val text: String, val tone: Tone)

@Composable
fun Badge(model: BadgeModel, modifier: Modifier = Modifier) {
    val scheme = MaterialTheme.colorScheme
    val (container, content) = when (model.tone) {
        Tone.Positive -> scheme.primaryContainer to scheme.onPrimaryContainer
        Tone.Warning -> scheme.tertiaryContainer to scheme.onTertiaryContainer
        Tone.Danger -> scheme.errorContainer to scheme.onErrorContainer
        Tone.Info -> scheme.secondaryContainer to scheme.onSecondaryContainer
        Tone.Neutral -> scheme.surfaceVariant to scheme.onSurfaceVariant
        Tone.Highlight -> scheme.primary to scheme.onPrimary
    }
    Surface(color = container, contentColor = content, shape = MaterialTheme.shapes.small, modifier = modifier) {
        Text(model.text, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
    }
}

/** Everything a listing card shows, already localised (the design system has no idea what a "scholarship" is). */
data class OpportunityCardModel(
    val id: String,
    val title: String,
    val kindLabel: String,
    val organization: String?,
    val place: String?,
    val badges: List<BadgeModel>,
    val saved: Boolean,
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun OpportunityCard(
    model: OpportunityCardModel,
    saveLabel: String,
    unsaveLabel: String,
    onClick: () -> Unit,
    onToggleSaved: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(onClick = onClick, modifier = modifier.fillMaxWidth()) {
        Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(model.kindLabel, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary, modifier = Modifier.weight(1f))
                IconButton(onClick = onToggleSaved) {
                    Icon(
                        imageVector = if (model.saved) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                        contentDescription = if (model.saved) unsaveLabel else saveLabel,
                        tint = if (model.saved) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Text(model.title, style = MaterialTheme.typography.titleMedium, maxLines = 3, overflow = TextOverflow.Ellipsis)
            val subtitle = listOfNotNull(model.organization, model.place).joinToString(" · ")
            if (subtitle.isNotBlank()) {
                Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            if (model.badges.isNotEmpty()) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    model.badges.forEach { Badge(it) }
                }
            }
        }
    }
}

@Composable
fun SectionHeader(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.onBackground,
        modifier = modifier.padding(top = 8.dp, bottom = 4.dp).semantics { heading() },
    )
}

@Composable
fun LoadingBox(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
}

@Composable
private fun CenteredMessage(icon: ImageVector, tint: Color, title: String, body: String?, modifier: Modifier, actions: @Composable () -> Unit) {
    Column(
        modifier.fillMaxWidth().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(40.dp))
        Text(title, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center, modifier = Modifier.semantics { heading() })
        if (body != null) Text(body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        actions()
    }
}

@Composable
fun EmptyState(title: String, body: String?, modifier: Modifier = Modifier, actionLabel: String? = null, onAction: (() -> Unit)? = null) {
    CenteredMessage(Icons.Filled.Info, MaterialTheme.colorScheme.primary, title, body, modifier) {
        if (actionLabel != null && onAction != null) OutlinedButton(onClick = onAction) { Text(actionLabel) }
    }
}

@Composable
fun ErrorState(message: String, retryLabel: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    CenteredMessage(Icons.Filled.Warning, MaterialTheme.colorScheme.error, message, null, modifier) {
        Button(onClick = onRetry) { Text(retryLabel) }
    }
}

@Composable
fun Banner(text: String, modifier: Modifier = Modifier, tone: Tone = Tone.Info) {
    val scheme = MaterialTheme.colorScheme
    val (container, content) = when (tone) {
        Tone.Warning -> scheme.tertiaryContainer to scheme.onTertiaryContainer
        Tone.Danger -> scheme.errorContainer to scheme.onErrorContainer
        Tone.Positive -> scheme.primaryContainer to scheme.onPrimaryContainer
        else -> scheme.secondaryContainer to scheme.onSecondaryContainer
    }
    Surface(color = container, contentColor = content, shape = MaterialTheme.shapes.medium, modifier = modifier.fillMaxWidth()) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Info, contentDescription = null, modifier = Modifier.size(20.dp))
            Spacer(Modifier.size(8.dp))
            Text(text, style = MaterialTheme.typography.bodyMedium)
        }
    }
}
