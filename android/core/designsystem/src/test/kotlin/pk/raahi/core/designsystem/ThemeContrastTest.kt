package pk.raahi.core.designsystem

import androidx.compose.material3.ColorScheme
import kotlin.test.Test
import kotlin.test.assertTrue

/** REQ-AND-008: the design system never ships a text/background pair below WCAG 2.2 AA. */
class ThemeContrastTest {
    private fun textPairs(scheme: ColorScheme) = mapOf(
        "onPrimary on primary" to (scheme.onPrimary to scheme.primary),
        "onPrimaryContainer on primaryContainer" to (scheme.onPrimaryContainer to scheme.primaryContainer),
        "onSecondary on secondary" to (scheme.onSecondary to scheme.secondary),
        "onSecondaryContainer on secondaryContainer" to (scheme.onSecondaryContainer to scheme.secondaryContainer),
        "onTertiary on tertiary" to (scheme.onTertiary to scheme.tertiary),
        "onTertiaryContainer on tertiaryContainer" to (scheme.onTertiaryContainer to scheme.tertiaryContainer),
        "onError on error" to (scheme.onError to scheme.error),
        "onErrorContainer on errorContainer" to (scheme.onErrorContainer to scheme.errorContainer),
        "onBackground on background" to (scheme.onBackground to scheme.background),
        "onSurface on surface" to (scheme.onSurface to scheme.surface),
        "onSurfaceVariant on surfaceVariant" to (scheme.onSurfaceVariant to scheme.surfaceVariant),
        "onSurfaceVariant on surface" to (scheme.onSurfaceVariant to scheme.surface),
        "onSurfaceVariant on background" to (scheme.onSurfaceVariant to scheme.background),
        "primary on surface (links, labels)" to (scheme.primary to scheme.surface),
        "error on surface" to (scheme.error to scheme.surface),
    )

    @Test
    fun `REQ-AND-008 every text pair meets 4_5 to 1 in the light theme`() {
        for ((name, pair) in textPairs(RaahiLightColors)) {
            val ratio = contrastRatio(pair.first, pair.second)
            assertTrue(ratio >= 4.5, "$name is only %.2f:1".format(ratio))
        }
    }

    @Test
    fun `REQ-AND-008 every text pair meets 4_5 to 1 in the dark theme`() {
        for ((name, pair) in textPairs(RaahiDarkColors)) {
            val ratio = contrastRatio(pair.first, pair.second)
            assertTrue(ratio >= 4.5, "$name is only %.2f:1".format(ratio))
        }
    }

    @Test
    fun `REQ-AND-008 component outlines meet 3 to 1 against the surface they sit on`() {
        for (scheme in listOf(RaahiLightColors, RaahiDarkColors)) {
            val ratio = contrastRatio(scheme.outline, scheme.surface)
            assertTrue(ratio >= 3.0, "outline on surface is only %.2f:1".format(ratio))
        }
    }

    @Test
    fun `REQ-AND-008 the contrast formula matches the WCAG reference values`() {
        val black = androidx.compose.ui.graphics.Color.Black
        val white = androidx.compose.ui.graphics.Color.White
        assertTrue(kotlin.math.abs(contrastRatio(black, white) - 21.0) < 0.01)
        assertTrue(kotlin.math.abs(contrastRatio(white, white) - 1.0) < 0.001)
        // #767676 on white is the classic "just passes AA" grey: 4.54:1
        assertTrue(kotlin.math.abs(contrastRatio(androidx.compose.ui.graphics.Color(0xFF767676), white) - 4.54) < 0.02)
    }
}
