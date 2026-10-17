package pk.raahi.feature.tools

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.time.LocalDate
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.Rule
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import pk.raahi.core.designsystem.RaahiTheme
import pk.raahi.core.network.AdviceDto
import pk.raahi.core.network.ApiError
import pk.raahi.core.network.ApiResult
import pk.raahi.core.network.BatchResponseDto
import pk.raahi.core.network.BilingualDto
import pk.raahi.core.network.GuideDetailResponseDto
import pk.raahi.core.network.GuideListDto
import pk.raahi.core.network.ManifestResponseDto
import pk.raahi.core.network.MetaResponseDto
import pk.raahi.core.network.ProgrammeListDto
import pk.raahi.core.network.RaahiApi
import pk.raahi.core.network.ResourceListDto
import pk.raahi.core.network.ScamAnalysisDto
import pk.raahi.core.network.ScamRequestDto
import pk.raahi.core.network.ScamResponseDto
import pk.raahi.core.network.SignalDto

private class FakeApi(var result: ApiResult<ScamResponseDto>) : RaahiApi {
    var requests = mutableListOf<ScamRequestDto>()
    var gate: CompletableDeferred<Unit>? = null

    override suspend fun scamCheck(request: ScamRequestDto): ApiResult<ScamResponseDto> {
        requests += request
        gate?.await()
        return result
    }

    override suspend fun meta(): ApiResult<MetaResponseDto> = ApiResult.Failure(ApiError.NotFound)

    override suspend fun manifest(ifNoneMatch: String?): ApiResult<ManifestResponseDto> = ApiResult.Failure(ApiError.NotFound)

    override suspend fun batch(ids: List<String>): ApiResult<BatchResponseDto> = ApiResult.Failure(ApiError.NotFound)

    override suspend fun programmes(language: String, query: String?): ApiResult<ProgrammeListDto> = ApiResult.Failure(ApiError.NotFound)

    override suspend fun guides(language: String): ApiResult<GuideListDto> = ApiResult.Failure(ApiError.NotFound)

    override suspend fun guide(id: String, language: String): ApiResult<GuideDetailResponseDto> = ApiResult.Failure(ApiError.NotFound)

    override suspend fun resources(language: String, category: String?): ApiResult<ResourceListDto> = ApiResult.Failure(ApiError.NotFound)
}

private val analysis = ScamAnalysisDto(
    score = 85,
    level = "high",
    signals = listOf(SignalDto("advance-fee", 30.0, "Asks for money first", "پہلے رقم مانگتا ہے", "text")),
    advice = listOf(AdviceDto("Do not pay anything.", "کوئی رقم نہ دیں۔", "https://beoe.gov.pk/list-of-oeps?show=active", BilingualDto("Open the BE&OE list", "بی ای او ای فہرست"))),
    headline = BilingualDto("This looks like a scam", "یہ فراڈ لگتا ہے"),
    disclaimer = BilingualDto("This is guidance, not a verdict.", "یہ رہنمائی ہے، فیصلہ نہیں۔"),
)

@OptIn(ExperimentalCoroutinesApi::class)
class ScamCheckViewModelTest {
    @BeforeTest
    fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @AfterTest
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `REQ-AND-011 nothing to check is refused locally without a network call`() {
        val api = FakeApi(ApiResult.Success(ScamResponseDto(analysis)))
        val vm = ScamCheckViewModel(api)
        vm.submit()
        assertEquals(ScamError.NEED_INPUT, vm.state.value.error)
        assertTrue(api.requests.isEmpty())
        vm.onText("   ")
        vm.submit()
        assertEquals(ScamError.NEED_INPUT, vm.state.value.error)
    }

    @Test
    fun `REQ-AND-011 the request carries only what the person provided (the server's schema is strict)`() {
        val api = FakeApi(ApiResult.Success(ScamResponseDto(analysis)))
        val vm = ScamCheckViewModel(api)
        vm.toggleAnswer("askedToPay")
        vm.submit()
        assertNull(api.requests.last().text, "blank text is omitted, not sent as an empty string")
        assertEquals(mapOf("askedToPay" to true), api.requests.last().answers)

        vm.onText("Pay Rs 5000 for a Dubai visa")
        vm.toggleAnswer("askedToPay")
        vm.submit()
        assertEquals("Pay Rs 5000 for a Dubai visa", api.requests.last().text)
        assertNull(api.requests.last().answers)
        assertEquals(85, vm.state.value.result?.score)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `REQ-AND-011 failures become specific, actionable messages`() {
        val cases = mapOf(
            ApiError.Offline to ScamError.OFFLINE,
            ApiError.Timeout to ScamError.OFFLINE,
            ApiError.RateLimited(30) to ScamError.RATE_LIMITED,
            ApiError.Unauthorized(false) to ScamError.UNAVAILABLE,
            ApiError.Forbidden to ScamError.UNAVAILABLE,
            ApiError.Server(503) to ScamError.UNAVAILABLE,
            ApiError.Server(500) to ScamError.GENERIC,
            ApiError.Malformed("x") to ScamError.GENERIC,
        )
        for ((error, expected) in cases) {
            val vm = ScamCheckViewModel(FakeApi(ApiResult.Failure(error)))
            vm.onText("some text")
            vm.submit()
            assertEquals(expected, vm.state.value.error, "$error")
            assertNull(vm.state.value.result)
            assertTrue(!vm.state.value.loading)
        }
    }

    @Test
    fun `REQ-AND-011 a second tap while checking is ignored, and the text is capped`() {
        val api = FakeApi(ApiResult.Success(ScamResponseDto(analysis)))
        val gate = CompletableDeferred<Unit>()
        api.gate = gate
        val vm = ScamCheckViewModel(api)
        vm.onText("x".repeat(7_000))
        assertEquals(ScamCheckViewModel.MAX_CHARS, vm.state.value.text.length)
        assertEquals(0, vm.state.value.charsLeft)
        vm.submit()
        vm.submit()
        assertEquals(1, api.requests.size)
        assertTrue(vm.state.value.loading)
        gate.complete(Unit)
        assertTrue(!vm.state.value.loading)
        vm.reset()
        assertEquals(ScamUiState(), vm.state.value)
    }
}

class AgeFormTest {
    private fun input(dob: Triple<String, String, String>, asOn: Triple<String, String, String> = Triple("15", "10", "2026"), max: String = "", relax: String = "", min: String = "") =
        AgeFormInput(dob.first, dob.second, dob.third, asOn.first, asOn.second, asOn.third, max, relax, min)

    @Test
    fun `REQ-AND-007 a valid form gives the age and both readings of the limit`() {
        val result = assertIs<AgeFormResult.Ok>(AgeForm.evaluate(input(Triple("15", "3", "1998"), max = "28", relax = "2", min = "18")))
        assertEquals(28, result.check.age.years)
        assertEquals(7, result.check.age.months)
        assertEquals(true, result.check.withinByCompletedYears)
        assertEquals(LocalDate.parse("2028-03-15"), result.check.lastDayToTheDay)
        assertEquals(true, result.check.meetsMinimum)
    }

    @Test
    fun `REQ-AND-007 every kind of bad input is reported, not guessed`() {
        fun errors(i: AgeFormInput) = assertIs<AgeFormResult.Invalid>(AgeForm.evaluate(i)).errors
        assertEquals(setOf(AgeFormError.DOB), errors(input(Triple("31", "2", "2000"))))
        assertEquals(setOf(AgeFormError.DOB), errors(input(Triple("1", "1", "98"))))
        assertEquals(setOf(AgeFormError.DOB), errors(input(Triple("", "", ""))))
        assertEquals(setOf(AgeFormError.DOB), errors(input(Triple("1", "13", "2000"))))
        assertEquals(setOf(AgeFormError.AS_ON), errors(input(Triple("1", "1", "2000"), asOn = Triple("0", "10", "2026"))))
        assertEquals(setOf(AgeFormError.ORDER), errors(input(Triple("1", "1", "2030"))))
        assertEquals(setOf(AgeFormError.NUMBER), errors(input(Triple("1", "1", "2000"), max = "abc")))
        assertEquals(setOf(AgeFormError.NUMBER), errors(input(Triple("1", "1", "2000"), max = "28", relax = "31")))
        assertEquals(setOf(AgeFormError.NUMBER), errors(input(Triple("1", "1", "2000"), min = "121")))
        assertEquals(setOf(AgeFormError.DOB, AgeFormError.NUMBER), errors(input(Triple("x", "1", "2000"), max = "-5")))
    }

    @Test
    fun `REQ-AND-007 optional numbers may be left empty and a leap-day birthday is handled`() {
        assertIs<AgeFormResult.Ok>(AgeForm.evaluate(input(Triple("29", "2", "2000"))))
        val feb = assertIs<AgeFormResult.Ok>(AgeForm.evaluate(input(Triple("29", "2", "2000"), asOn = Triple("28", "2", "2026"), max = "25")))
        assertEquals(25, feb.check.age.years)
        assertEquals(LocalDate.parse("2025-03-01"), feb.check.lastDayToTheDay)
        assertIs<AgeFormResult.Invalid>(AgeForm.evaluate(input(Triple("29", "2", "2001"))))
    }
}

@RunWith(AndroidJUnit4::class)
@Config(sdk = [35])
class ScamScreenEnglishTest {
    @get:Rule
    val rule = createComposeRule()

    @Test
    fun `REQ-AND-011 the result is shown in English with its warning signs and a safe official link`() {
        var opened: String? = null
        rule.setContent { RaahiTheme { ScamCheckScreen(ScamUiState(text = "x", result = analysis), {}, {}, {}, {}, { opened = it }) } }
        rule.onNodeWithText("High risk").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("This looks like a scam").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("• Asks for money first").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("Open the BE&OE list").performScrollTo().performClick()
        assertEquals("https://beoe.gov.pk/list-of-oeps?show=active", opened)
    }

    @Test
    fun `REQ-AND-011 the person is told their text is sent for checking and not stored`() {
        rule.setContent { RaahiTheme { ScamCheckScreen(ScamUiState(), {}, {}, {}, {}, {}) } }
        rule.onNodeWithText("Your text is sent securely to RAAHI to be checked in memory. It is not stored or logged. Do not paste passwords or OTPs.").assertIsDisplayed()
    }
}

@RunWith(AndroidJUnit4::class)
@Config(sdk = [35], qualifiers = "ur")
class ScamScreenUrduTest {
    @get:Rule
    val rule = createComposeRule()

    @Test
    fun `REQ-AND-005 in an Urdu locale the server's Urdu text is chosen`() {
        rule.setContent { RaahiTheme { ScamCheckScreen(ScamUiState(text = "x", result = analysis), {}, {}, {}, {}, {}) } }
        rule.onNodeWithText("یہ فراڈ لگتا ہے").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("• پہلے رقم مانگتا ہے").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("زیادہ خطرہ").performScrollTo().assertIsDisplayed()
    }
}
