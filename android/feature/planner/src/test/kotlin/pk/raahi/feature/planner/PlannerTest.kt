package pk.raahi.feature.planner

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.cash.turbine.test
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Rule
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import pk.raahi.core.data.DocState
import pk.raahi.core.data.DocumentSource
import pk.raahi.core.designsystem.RaahiTheme
import pk.raahi.core.network.ApiJson
import pk.raahi.core.network.CycleDto
import pk.raahi.core.network.GuideDetailResponseDto
import pk.raahi.core.network.GuideListDto
import pk.raahi.core.network.ProgrammeDto
import pk.raahi.core.network.ProgrammeListDto
import pk.raahi.core.network.ResourceListDto
import pk.raahi.core.testing.Fixtures

private fun programme(id: String, phase: String, prepareNow: Boolean = false, title: String = "Programme $id", provider: String = "Provider", cycle: CycleDto? = null, official: String = "https://example.org/$id") = ProgrammeDto(
    id = id, kind = "scholarship", title = title, provider = provider, place = "UK", levels = listOf("masters"), funding = "full", summary = "Summary of $id",
    route = "direct", routeNote = "Apply on the official portal", usualWindow = "September to October", phase = phase, prepareNow = prepareNow,
    prepare = listOf("Get your transcripts", "Book an English test"), cycle = cycle, official = official, reviewed = "2026-10-01",
)

class ProgrammeGroupingTest {
    @Test
    fun `REQ-DAT-005 grouping partitions every programme exactly once and keeps the server's urgency order`() {
        val real = ApiJson.decodeFromString(ProgrammeListDto.serializer(), Fixtures.text("programmes.list.json")).data
        val many = real + listOf(
            programme("a", "upcoming"), programme("b", "off-season", prepareNow = true), programme("c", "closed"), programme("d", "typically-open"), programme("e", "closing-soon"), programme("f", "open"),
        )
        val groups = groupProgrammes(many)
        val flattened = groups.act + groups.soon + groups.prepare + groups.later
        assertEquals(many.map { it.id }.sorted(), flattened.map { it.id }.sorted(), "no programme is lost or duplicated")
        assertTrue(groups.act.all { it.phase in setOf("closing-soon", "open", "typically-open") })
        assertEquals(listOf("a"), groups.soon.map { it.id }.filter { it == "a" })
        assertEquals(listOf("b"), groups.prepare.map { it.id }.filter { it == "b" })
        assertTrue(groups.later.any { it.id == "c" })
        assertEquals(listOf("d", "e", "f"), groups.act.map { it.id }.filter { it in setOf("d", "e", "f") }, "relative order is preserved")
    }

    @Test
    fun `REQ-DAT-005 searching matches the name, the provider or the summary, ignoring case and spaces at the ends`() {
        val list = listOf(programme("a", "open", title = "Chevening Scholarships", provider = "FCDO"), programme("b", "open", title = "DAAD EPOS", provider = "DAAD"))
        assertEquals(listOf("a"), filterProgrammes(list, "  CHEVENING ").map { it.id })
        assertEquals(listOf("b"), filterProgrammes(list, "daad").map { it.id })
        assertEquals(listOf("a", "b"), filterProgrammes(list, "").map { it.id })
        assertEquals(emptyList(), filterProgrammes(list, "zzz"))
        assertEquals(listOf("a", "b"), filterProgrammes(list, "summary of").map { it.id })
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class LearnViewModelTest {
    private class FakeDocuments : DocumentSource {
        val programmeCalls = mutableListOf<String>()
        override fun programmes(language: String): Flow<DocState<ProgrammeListDto>> {
            programmeCalls += language
            return flowOf(DocState(ProgrammeListDto(listOf(programme("p-$language", "open")), "2026-10-15")))
        }

        override fun guides(language: String): Flow<DocState<GuideListDto>> = flowOf(DocState(GuideListDto(emptyList())))

        override fun guide(id: String, language: String): Flow<DocState<GuideDetailResponseDto>> = flowOf(DocState())

        override fun resources(language: String): Flow<DocState<ResourceListDto>> = flowOf(DocState(ResourceListDto(emptyList(), 0)))
    }

    @BeforeTest
    fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @AfterTest
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `REQ-AND-005 programmes are re-requested in the new language when the app language changes, and on retry`() = runTest {
        val documents = FakeDocuments()
        val language = MutableStateFlow("en")
        val vm = LearnViewModel(documents, language)
        vm.programmes.test {
            var latest = awaitItem()
            while (latest.data?.data?.firstOrNull()?.id != "p-en") latest = awaitItem()
            language.value = "ur"
            while (latest.data?.data?.firstOrNull()?.id != "p-ur") latest = awaitItem()
            vm.retry()
            cancelAndIgnoreRemainingEvents()
        }
        assertTrue(documents.programmeCalls.containsAll(listOf("en", "ur")))
        assertTrue(documents.programmeCalls.size >= 3, "retry fetched again: ${documents.programmeCalls}")
        vm.onQueryChange("x".repeat(500))
        assertEquals(100, vm.searchQuery.value.length)
    }
}

@RunWith(AndroidJUnit4::class)
@Config(sdk = [35])
class ProgrammeCardTest {
    @get:Rule
    val rule = createComposeRule()

    private val official = CycleDto(label = "2027/28", closes = "2026-11-05", confidence = "official", checked = "2026-10-15", source = "https://example.org")
    private val reported = official.copy(confidence = "reported", closesNote = "4 pm PKT")

    @Test
    fun `REQ-DAT-005 an official date says so and a reported date tells the person to confirm it`() {
        rule.setContent { RaahiTheme { ProgrammeCard(programme("a", "open", cycle = official), expanded = false, onToggle = {}, onOpenLink = {}) } }
        rule.onNodeWithText("Official date").assertIsDisplayed()
        rule.setContent { RaahiTheme { ProgrammeCard(programme("b", "open", cycle = reported), expanded = false, onToggle = {}, onOpenLink = {}) } }
        rule.onNodeWithText("Reported - confirm on the official page").assertIsDisplayed()
        rule.onNodeWithText("4 pm PKT").assertIsDisplayed()
    }

    @Test
    fun `REQ-DAT-005 closing soon shows the days left and the card expands to the details and the official link`() {
        var toggled = 0
        var opened: String? = null
        val closing = programme("a", "closing-soon", prepareNow = true, cycle = official).copy(daysLeft = 5)
        rule.setContent { RaahiTheme { ProgrammeCard(closing, expanded = true, onToggle = { toggled += 1 }, onOpenLink = { opened = it }) } }
        rule.onNodeWithText("5 days left").assertIsDisplayed()
        rule.onNodeWithText("Start preparing now").assertIsDisplayed()
        rule.onNodeWithText("Apply on the official portal").assertIsDisplayed()
        rule.onNodeWithText("• Get your transcripts").assertIsDisplayed()
        rule.onNodeWithText("Open the official page").performClick()
        assertEquals("https://example.org/a", opened)
        rule.onNodeWithText("Programme a").performClick()
        assertEquals(1, toggled)
    }

    @Test
    fun `REQ-AND-009 a link that fails the safety policy cannot be opened`() {
        var opened = 0
        rule.setContent { RaahiTheme { ProgrammeCard(programme("a", "open", official = "http://127.0.0.1/evil"), expanded = true, onToggle = {}, onOpenLink = { opened += 1 }) } }
        rule.onNodeWithText("Open the official page").assertIsNotEnabled()
        assertEquals(0, opened)
    }
}
