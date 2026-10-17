package pk.raahi.feature.tools

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp

@Composable
fun ToolsHomeScreen(onScamCheck: () -> Unit, onAgeCalculator: () -> Unit, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ToolCard(stringResource(R.string.tools_scam_title), stringResource(R.string.tools_scam_body), onScamCheck)
        ToolCard(stringResource(R.string.tools_age_title), stringResource(R.string.tools_age_body), onAgeCalculator)
    }
}

@Composable
private fun ToolCard(title: String, body: String, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
