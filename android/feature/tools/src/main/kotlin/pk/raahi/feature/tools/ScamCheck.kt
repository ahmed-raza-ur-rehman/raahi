package pk.raahi.feature.tools

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import pk.raahi.core.designsystem.Badge
import pk.raahi.core.designsystem.BadgeModel
import pk.raahi.core.designsystem.Banner
import pk.raahi.core.designsystem.SectionHeader
import pk.raahi.core.designsystem.Tone
import pk.raahi.core.model.UrlPolicy
import pk.raahi.core.network.ApiError
import pk.raahi.core.network.ApiResult
import pk.raahi.core.network.RaahiApi
import pk.raahi.core.network.ScamAnalysisDto
import pk.raahi.core.network.ScamRequestDto

/** The answers the server's checklist understands (same keys as the website), in the order people meet them. */
object ScamAnswers {
    val keys = listOf(
        "askedToPay", "paymentToPersonalAccount", "contactOnlyMessaging", "noInterview", "noLicenceNumber",
        "pressureToDecide", "guaranteedResult", "visitVisaForWork", "askedForOtpOrPassword", "verifiedOnOfficialSite",
    )

    @StringRes
    fun label(key: String): Int = when (key) {
        "askedToPay" -> R.string.scam_answer_askedToPay
        "paymentToPersonalAccount" -> R.string.scam_answer_paymentToPersonalAccount
        "contactOnlyMessaging" -> R.string.scam_answer_contactOnlyMessaging
        "noInterview" -> R.string.scam_answer_noInterview
        "noLicenceNumber" -> R.string.scam_answer_noLicenceNumber
        "pressureToDecide" -> R.string.scam_answer_pressureToDecide
        "guaranteedResult" -> R.string.scam_answer_guaranteedResult
        "visitVisaForWork" -> R.string.scam_answer_visitVisaForWork
        "askedForOtpOrPassword" -> R.string.scam_answer_askedForOtpOrPassword
        else -> R.string.scam_answer_verifiedOnOfficialSite
    }
}

enum class ScamError { NEED_INPUT, OFFLINE, UNAVAILABLE, RATE_LIMITED, GENERIC }

data class ScamUiState(
    val text: String = "",
    val answers: Set<String> = emptySet(),
    val loading: Boolean = false,
    val result: ScamAnalysisDto? = null,
    val error: ScamError? = null,
) {
    val charsLeft: Int get() = ScamCheckViewModel.MAX_CHARS - text.length
}

internal fun ApiError.toScamError(): ScamError = when (this) {
    ApiError.Offline, ApiError.Timeout -> ScamError.OFFLINE
    is ApiError.RateLimited -> ScamError.RATE_LIMITED
    is ApiError.Unauthorized, ApiError.Forbidden -> ScamError.UNAVAILABLE
    is ApiError.Server -> if (status == 503) ScamError.UNAVAILABLE else ScamError.GENERIC
    else -> ScamError.GENERIC
}

class ScamCheckViewModel(private val api: RaahiApi) : ViewModel() {
    private val mutableState = MutableStateFlow(ScamUiState())
    val state: StateFlow<ScamUiState> = mutableState.asStateFlow()

    fun onText(text: String) {
        mutableState.value = mutableState.value.copy(text = text.take(MAX_CHARS), error = null)
    }

    fun toggleAnswer(key: String) {
        val current = mutableState.value
        mutableState.value = current.copy(answers = if (key in current.answers) current.answers - key else current.answers + key, error = null)
    }

    fun submit() {
        val current = mutableState.value
        if (current.loading) return
        if (current.text.isBlank() && current.answers.isEmpty()) {
            mutableState.value = current.copy(error = ScamError.NEED_INPUT)
            return
        }
        viewModelScope.launch {
            mutableState.value = mutableState.value.copy(loading = true, error = null, result = null)
            val request = ScamRequestDto(text = current.text.takeIf { it.isNotBlank() }, answers = current.answers.associateWith { true }.takeIf { it.isNotEmpty() })
            mutableState.value = when (val result = api.scamCheck(request)) {
                is ApiResult.Success -> mutableState.value.copy(loading = false, result = result.value.data)
                is ApiResult.Failure -> mutableState.value.copy(loading = false, error = result.error.toScamError())
                ApiResult.NotModified -> mutableState.value.copy(loading = false, error = ScamError.GENERIC)
            }
        }
    }

    fun reset() {
        mutableState.value = ScamUiState()
    }

    class Factory(private val api: RaahiApi) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = ScamCheckViewModel(api) as T
    }

    companion object {
        const val MAX_CHARS = 6000
    }
}

@Composable
fun ScamCheckRoute(viewModel: ScamCheckViewModel, onBack: () -> Unit, onOpenLink: (String) -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ScamCheckScreen(state, viewModel::onText, viewModel::toggleAnswer, viewModel::submit, onBack, onOpenLink)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScamCheckScreen(
    state: ScamUiState,
    onText: (String) -> Unit,
    onToggle: (String) -> Unit,
    onSubmit: () -> Unit,
    onBack: () -> Unit,
    onOpenLink: (String) -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.tools_scam_title)) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.tools_back)) } },
            )
        },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Banner(stringResource(R.string.scam_privacy))
            OutlinedTextField(
                value = state.text,
                onValueChange = onText,
                label = { Text(stringResource(R.string.scam_paste_label)) },
                supportingText = { Text(pluralStringResource(R.plurals.scam_chars_left, state.charsLeft.coerceAtLeast(0), state.charsLeft)) },
                minLines = 5,
                maxLines = 10,
                modifier = Modifier.fillMaxWidth(),
            )
            SectionHeader(stringResource(R.string.scam_checklist_title))
            ScamAnswers.keys.forEach { key ->
                val checked = key in state.answers
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 48.dp).toggleable(value = checked, role = Role.Checkbox, onValueChange = { onToggle(key) }),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Checkbox(checked = checked, onCheckedChange = null)
                    Text(stringResource(ScamAnswers.label(key)), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(start = 8.dp))
                }
            }
            state.error?.let { Banner(stringResource(it.messageRes()), tone = Tone.Danger) }
            Button(onClick = onSubmit, enabled = !state.loading, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(if (state.loading) R.string.scam_checking else R.string.scam_check_button))
            }
            state.result?.let { ScamResult(it, onOpenLink) }
        }
    }
}

@StringRes
private fun ScamError.messageRes(): Int = when (this) {
    ScamError.NEED_INPUT -> R.string.scam_need_input
    ScamError.OFFLINE -> R.string.scam_error_offline
    ScamError.UNAVAILABLE -> R.string.scam_error_unavailable
    ScamError.RATE_LIMITED -> R.string.scam_error_rate_limited
    ScamError.GENERIC -> R.string.scam_error_generic
}

@Composable
private fun ScamResult(result: ScamAnalysisDto, onOpenLink: (String) -> Unit) {
    val urdu = LocalConfiguration.current.locales[0].language == "ur"
    val (levelText, tone) = when (result.level) {
        "high" -> R.string.scam_level_high to Tone.Danger
        "medium" -> R.string.scam_level_medium to Tone.Warning
        "low" -> R.string.scam_level_low to Tone.Info
        else -> R.string.scam_level_none to Tone.Positive
    }
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Badge(BadgeModel(stringResource(levelText), tone))
            Text(if (urdu) result.headline.ur else result.headline.en, style = MaterialTheme.typography.titleMedium)
            Text(stringResource(R.string.scam_score, result.score), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (result.signals.isNotEmpty()) {
                SectionHeader(stringResource(R.string.scam_signals))
                result.signals.forEach { Text("• ${if (urdu) it.ur else it.en}", style = MaterialTheme.typography.bodyMedium) }
            }
            if (result.advice.isNotEmpty()) {
                SectionHeader(stringResource(R.string.scam_advice))
                result.advice.forEach { advice ->
                    Text(if (urdu) advice.ur else advice.en, style = MaterialTheme.typography.bodyMedium)
                    val url = advice.url
                    if (url != null && UrlPolicy.isSafeToOpen(url)) {
                        OutlinedButton(onClick = { onOpenLink(url) }) { Text(advice.label?.let { if (urdu) it.ur else it.en } ?: stringResource(R.string.scam_open_link)) }
                    }
                }
            }
            Text(if (urdu) result.disclaimer.ur else result.disclaimer.en, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
