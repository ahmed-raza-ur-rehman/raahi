package pk.raahi.core.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/*
 * RAAHI's palette, taken from the website (forest green, paper, amber, sky) and adjusted so every text/background pair
 * meets WCAG 2.2 AA (4.5:1 for text, 3:1 for component outlines). ThemeContrastTest recomputes every pair on each build,
 * so a colour edit that breaks accessibility fails CI instead of shipping.
 */
val RaahiLightColors: ColorScheme = lightColorScheme(
    primary = Color(0xFF176B4B),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFE3F3EB),
    onPrimaryContainer = Color(0xFF092D20),
    secondary = Color(0xFF2563EB),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFDCE8FD),
    onSecondaryContainer = Color(0xFF0B2A66),
    tertiary = Color(0xFF9A5406),
    onTertiary = Color(0xFFFFFFFF),
    tertiaryContainer = Color(0xFFFFF4D8),
    onTertiaryContainer = Color(0xFF5A3000),
    error = Color(0xFFB42318),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFFFF0EE),
    onErrorContainer = Color(0xFF5C0F08),
    background = Color(0xFFEEF4F1),
    onBackground = Color(0xFF10231C),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF10231C),
    surfaceVariant = Color(0xFFE8F0EC),
    onSurfaceVariant = Color(0xFF3F5249),
    outline = Color(0xFF61756D),
    outlineVariant = Color(0xFFD8E5DF),
)

val RaahiDarkColors: ColorScheme = darkColorScheme(
    primary = Color(0xFF8FD1B1),
    onPrimary = Color(0xFF00391F),
    primaryContainer = Color(0xFF0D4D35),
    onPrimaryContainer = Color(0xFFC9EEDC),
    secondary = Color(0xFFAEC6FF),
    onSecondary = Color(0xFF0B2A66),
    secondaryContainer = Color(0xFF1E3F8A),
    onSecondaryContainer = Color(0xFFDCE8FD),
    tertiary = Color(0xFFFFB95C),
    onTertiary = Color(0xFF482900),
    tertiaryContainer = Color(0xFF6B3C00),
    onTertiaryContainer = Color(0xFFFFDDB3),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),
    background = Color(0xFF0B1A14),
    onBackground = Color(0xFFE1EDE7),
    surface = Color(0xFF12241D),
    onSurface = Color(0xFFE1EDE7),
    surfaceVariant = Color(0xFF2D4239),
    onSurfaceVariant = Color(0xFFBDD0C7),
    outline = Color(0xFF8AA196),
    outlineVariant = Color(0xFF3F5249),
)

private val base = Typography()

/** Slightly looser line heights than the Material default: Urdu (Naskh/Nastaliq) needs the extra vertical room. */
val RaahiTypography: Typography = Typography(
    titleLarge = base.titleLarge.copy(lineHeight = 32.sp),
    titleMedium = base.titleMedium.copy(lineHeight = 26.sp),
    bodyLarge = base.bodyLarge.copy(lineHeight = 26.sp),
    bodyMedium = base.bodyMedium.copy(lineHeight = 22.sp),
    labelLarge = base.labelLarge.copy(lineHeight = 20.sp),
    labelMedium = base.labelMedium.copy(lineHeight = 18.sp),
    labelSmall = TextStyle(fontSize = 12.sp, lineHeight = 16.sp),
)

val RaahiShapes = Shapes(
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(20.dp),
)

@Composable
fun RaahiTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (darkTheme) RaahiDarkColors else RaahiLightColors,
        typography = RaahiTypography,
        shapes = RaahiShapes,
        content = content,
    )
}
