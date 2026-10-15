package pk.raahi.feature.tools

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import java.time.DateTimeException
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import pk.raahi.core.designsystem.Banner
import pk.raahi.core.designsystem.SectionHeader
import pk.raahi.core.designsystem.Tone
import pk.raahi.core.model.AgeCalculator
import pk.raahi.core.model.AgeCheck
import pk.raahi.core.model.AgeCheckInput

enum class AgeFormError { DOB, AS_ON, ORDER, NUMBER }

/** What the person typed, as text, so validation is a pure function that is easy to test. */
data class AgeFormInput(
    val dobDay: String = "",
    val dobMonth: String = "",
    val dobYear: String = "",
    val asOnDay: String = "",
    val asOnMonth: String = "",
    val asOnYear: String = "",
    val maxYears: String = "",
    val relaxationYears: String = "",
    val minYears: String = "",
)

sealed interface AgeFormResult {
    data class Invalid(val errors: Set<AgeFormError>) : AgeFormResult

    data class Ok(val input: AgeCheckInput, val check: AgeCheck) : AgeFormResult
}

object AgeForm {
    private fun date(day: String, month: String, year: String): LocalDate? {
        if (!day.all(Char::isDigit) || !month.all(Char::isDigit) || !year.all(Char::isDigit)) return null
        if (day.isEmpty() || month.isEmpty() || year.length != 4 || day.length > 2 || month.length > 2) return null
        return try {
            LocalDate.of(year.toInt(), month.toInt(), day.toInt()).takeIf { it.year in 1900..2200 }
        } catch (_: DateTimeException) {
            null
        }
    }

    private fun number(text: String, max: Int): Result<Int?> {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return Result.success(null)
        val value = trimmed.takeIf { it.length <= 3 && it.all(Char::isDigit) }?.toInt()
        return if (value != null && value <= max) Result.success(value) else Result.failure(IllegalArgumentException("number"))
    }

    fun evaluate(input: AgeFormInput): AgeFormResult {
        val errors = linkedSetOf<AgeFormError>()
        val dob = date(input.dobDay, input.dobMonth, input.dobYear)
        val asOn = date(input.asOnDay, input.asOnMonth, input.asOnYear)
        if (dob == null) errors += AgeFormError.DOB
        if (asOn == null) errors += AgeFormError.AS_ON
        val max = number(input.maxYears, 120)
        val relaxation = number(input.relaxationYears, 30)
        val min = number(input.minYears, 120)
        if (max.isFailure || relaxation.isFailure || min.isFailure) errors += AgeFormError.NUMBER
        if (dob != null && asOn != null && dob.isAfter(asOn)) errors += AgeFormError.ORDER
        if (errors.isNotEmpty() || dob == null || asOn == null) return AgeFormResult.Invalid(errors)

        val checkInput = AgeCheckInput(dob, asOn, max.getOrNull(), relaxation.getOrNull() ?: 0, min.getOrNull())
        val check = AgeCalculator.check(checkInput) ?: return AgeFormResult.Invalid(setOf(AgeFormError.ORDER))
        return AgeFormResult.Ok(checkInput, check)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AgeCalculatorScreen(today: LocalDate, onBack: () -> Unit) {
    var form by rememberSaveable(stateSaver = AgeFormSaver) { mutableStateOf(AgeFormInput(asOnDay = today.dayOfMonth.toString(), asOnMonth = today.monthValue.toString(), asOnYear = today.year.toString())) }
    var calculated by rememberSaveable { mutableStateOf(false) }
    val evaluated = if (calculated) AgeForm.evaluate(form) else null

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.tools_age_title)) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.tools_back)) } },
            )
        },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SectionHeader(stringResource(R.string.age_dob))
            DateRow(form.dobDay, form.dobMonth, form.dobYear) { d, m, y -> form = form.copy(dobDay = d, dobMonth = m, dobYear = y) }
            SectionHeader(stringResource(R.string.age_as_on))
            DateRow(form.asOnDay, form.asOnMonth, form.asOnYear) { d, m, y -> form = form.copy(asOnDay = d, asOnMonth = m, asOnYear = y) }
            NumberField(R.string.age_max, form.maxYears) { form = form.copy(maxYears = it) }
            NumberField(R.string.age_relaxation, form.relaxationYears) { form = form.copy(relaxationYears = it) }
            NumberField(R.string.age_min, form.minYears) { form = form.copy(minYears = it) }
            Button(onClick = { calculated = true }, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.age_calculate)) }
            when (evaluated) {
                is AgeFormResult.Invalid -> evaluated.errors.forEach { Banner(stringResource(it.messageRes()), Tone.Danger) }
                is AgeFormResult.Ok -> AgeResult(evaluated.check)
                null -> Unit
            }
            Text(stringResource(R.string.age_explain), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

private fun AgeFormError.messageRes(): Int = when (this) {
    AgeFormError.DOB -> R.string.age_error_dob
    AgeFormError.AS_ON -> R.string.age_error_as_on
    AgeFormError.ORDER -> R.string.age_error_order
    AgeFormError.NUMBER -> R.string.age_error_number
}

@Composable
private fun DateRow(day: String, month: String, year: String, onChange: (String, String, String) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        NumberField(R.string.age_day, day, Modifier.weight(1f)) { onChange(it.take(2), month, year) }
        NumberField(R.string.age_month, month, Modifier.weight(1f)) { onChange(day, it.take(2), year) }
        NumberField(R.string.age_year, year, Modifier.weight(1.4f)) { onChange(day, month, it.take(4)) }
    }
}

@Composable
private fun NumberField(label: Int, value: String, modifier: Modifier = Modifier, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = { text -> onChange(text.filter(Char::isDigit)) },
        label = { Text(stringResource(label)) },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        singleLine = true,
        modifier = modifier.fillMaxWidth(),
    )
}

@Composable
private fun AgeResult(check: AgeCheck) {
    val locale = LocalConfiguration.current.locales[0]
    val formatter = DateTimeFormatter.ofLocalizedDate(FormatStyle.LONG).withLocale(locale)
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(stringResource(R.string.age_result_age), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(stringResource(R.string.age_result_value, check.age.years, check.age.months, check.age.days), style = MaterialTheme.typography.titleLarge)
            check.withinByCompletedYears?.let { Text("${stringResource(R.string.age_within_years)}: ${stringResource(if (it) R.string.age_yes else R.string.age_no)}", style = MaterialTheme.typography.bodyLarge) }
            check.withinToTheDay?.let { Text("${stringResource(R.string.age_within_day)}: ${stringResource(if (it) R.string.age_yes else R.string.age_no)}", style = MaterialTheme.typography.bodyLarge) }
            check.lastDayByCompletedYears?.let { Text(stringResource(R.string.age_last_day_years, it.format(formatter)), style = MaterialTheme.typography.bodyMedium) }
            check.lastDayToTheDay?.let { Text(stringResource(R.string.age_last_day_day, it.format(formatter)), style = MaterialTheme.typography.bodyMedium) }
            check.meetsMinimum?.let { Text("${stringResource(R.string.age_meets_min)}: ${stringResource(if (it) R.string.age_yes else R.string.age_no)}", style = MaterialTheme.typography.bodyMedium) }
        }
    }
}

private val AgeFormSaver = androidx.compose.runtime.saveable.listSaver<AgeFormInput, String>(
    save = { listOf(it.dobDay, it.dobMonth, it.dobYear, it.asOnDay, it.asOnMonth, it.asOnYear, it.maxYears, it.relaxationYears, it.minYears) },
    restore = { AgeFormInput(it[0], it[1], it[2], it[3], it[4], it[5], it[6], it[7], it[8]) },
)
