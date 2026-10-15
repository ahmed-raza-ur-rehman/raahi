package pk.raahi.core.designsystem

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlin.test.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(sdk = [35])
class ComponentsTest {
    @get:Rule
    val rule = createComposeRule()

    private fun model(saved: Boolean = false) = OpportunityCardModel(
        id = "a",
        title = "Chevening Scholarships",
        kindLabel = "Scholarship",
        organization = "FCDO",
        place = "United Kingdom",
        badges = listOf(BadgeModel("Closes in 5 days", Tone.Warning), BadgeModel("Fully funded", Tone.Positive)),
        saved = saved,
    )

    @Test
    fun `REQ-AND-008 the card shows its content and the whole card is one click target`() {
        var opened = 0
        rule.setContent { RaahiTheme { OpportunityCard(model(), "Save", "Remove from saved", { opened += 1 }, {}) } }
        rule.onNodeWithText("Chevening Scholarships").assertIsDisplayed()
        rule.onNodeWithText("FCDO · United Kingdom").assertIsDisplayed()
        rule.onNodeWithText("Closes in 5 days").assertIsDisplayed()
        rule.onNodeWithText("Chevening Scholarships").performClick()
        assertEquals(1, opened)
    }

    @Test
    fun `REQ-AND-008 the save button announces its state to screen readers and toggles independently of the card`() {
        var opened = 0
        var toggled = 0
        rule.setContent { RaahiTheme { OpportunityCard(model(saved = false), "Save", "Remove from saved", { opened += 1 }, { toggled += 1 }) } }
        rule.onNodeWithContentDescription("Save").assertIsDisplayed().performClick()
        assertEquals(1, toggled)
        assertEquals(0, opened, "tapping the heart must not open the listing")
    }

    @Test
    fun `REQ-AND-008 a saved card announces the opposite action`() {
        rule.setContent { RaahiTheme { OpportunityCard(model(saved = true), "Save", "Remove from saved", {}, {}) } }
        rule.onNodeWithContentDescription("Remove from saved").assertIsDisplayed()
    }

    @Test
    fun `REQ-AND-008 the error state offers a retry`() {
        var retried = 0
        rule.setContent { RaahiTheme { ErrorState("You are offline", "Try again", { retried += 1 }) } }
        rule.onNodeWithText("You are offline").assertIsDisplayed()
        rule.onNode(hasClickAction()).performClick()
        assertEquals(1, retried)
    }

    @Test
    fun `REQ-AND-008 the empty state offers its action`() {
        var cleared = 0
        rule.setContent { RaahiTheme { EmptyState("No matches", "Try other words", actionLabel = "Clear filters", onAction = { cleared += 1 }) } }
        rule.onNodeWithText("Clear filters").performClick()
        assertEquals(1, cleared)
    }
}
