package pk.raahi.feature.opportunities

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import pk.raahi.core.data.SyncState
import pk.raahi.core.designsystem.RaahiTheme
import pk.raahi.core.model.OpportunityFilter
import pk.raahi.core.model.OpportunityKind

@RunWith(AndroidJUnit4::class)
@Config(sdk = [35])
class OpportunitiesScreenTest {
    @get:Rule
    val rule = createComposeRule()

    private fun show(state: OpportunitiesUiState, onFilter: (((OpportunityFilter) -> OpportunityFilter)) -> Unit = {}, onOpen: (String) -> Unit = {}, onSaved: (String) -> Unit = {}, onClear: () -> Unit = {}, onQuery: (String) -> Unit = {}, onRefresh: () -> Unit = {}) {
        rule.setContent { RaahiTheme { OpportunitiesScreen(state, onQuery, onFilter, onClear, onSaved, onRefresh, onOpen) } }
    }

    @Test
    fun `REQ-AND-001 listings are shown with a count and open when tapped`() {
        var opened: String? = null
        show(
            OpportunitiesUiState(items = listOf(opportunity("a", title = "Chevening Scholarships", deadline = "2026-10-20"), opportunity("b", title = "DAAD masters")), storedCount = 2, syncState = SyncState(lastSuccessAt = NOW)),
            onOpen = { opened = it },
        )
        rule.onNodeWithText("2 opportunities").assertIsDisplayed()
        rule.onNodeWithText("Chevening Scholarships").assertIsDisplayed()
        rule.onNodeWithText("DAAD masters").assertIsDisplayed()
        rule.onNodeWithText("Chevening Scholarships").performClick()
        assertEquals("a", opened)
    }

    @Test
    fun `REQ-AND-008 the save button on a card reports the right id and states its action`() {
        val saved = mutableListOf<String>()
        show(OpportunitiesUiState(items = listOf(opportunity("a", title = "Alpha")), storedCount = 1), onSaved = { saved += it })
        rule.onNodeWithContentDescription("Save").performClick()
        assertEquals(listOf("a"), saved)
    }

    @Test
    fun `REQ-AND-001 filter chips report changes and search text is forwarded`() {
        var kinds: Set<OpportunityKind>? = null
        val typed = mutableListOf<String>()
        show(
            OpportunitiesUiState(items = listOf(opportunity("a")), storedCount = 1),
            onFilter = { transform -> kinds = transform(OpportunityFilter()).kinds },
            onQuery = { typed += it },
        )
        rule.onNodeWithText("Jobs").performClick()
        assertEquals(setOf(OpportunityKind.JOB), kinds)
        rule.onNode(hasText("Search scholarships, jobs, courses…")).performTextInput("daad")
        assertTrue(typed.isNotEmpty() && typed.last().endsWith("d"))
    }

    @Test
    fun `REQ-AND-001 no results offers to clear the filters`() {
        var cleared = 0
        show(OpportunitiesUiState(items = emptyList(), storedCount = 40, filter = OpportunityFilter(query = "zzz")), onClear = { cleared += 1 })
        rule.onNodeWithText("No matches").assertIsDisplayed()
        rule.onNodeWithText("Clear filters").performClick()
        assertEquals(1, cleared)
    }

    @Test
    fun `REQ-AND-002 with nothing stored and no connection the person is told what to do, and can retry`() {
        var retried = 0
        show(OpportunitiesUiState(items = emptyList(), storedCount = 0, syncing = false), onRefresh = { retried += 1 })
        rule.onNodeWithText("You are offline. Connect once to download opportunities; after that the app works without internet.").assertIsDisplayed()
        rule.onNodeWithText("Try again").performClick()
        assertEquals(1, retried)
    }

    @Test
    fun `REQ-AND-002 while the first download runs a progress message replaces the error`() {
        show(OpportunitiesUiState(items = emptyList(), storedCount = 0, syncing = true))
        rule.onNodeWithText("Getting the latest opportunities…").assertIsDisplayed()
    }
}
