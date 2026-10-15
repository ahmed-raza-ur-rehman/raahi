package pk.raahi.core.designsystem

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable

@Composable
fun SkeletonLabel(text: String) {
    MaterialTheme {
        Text(text)
    }
}
