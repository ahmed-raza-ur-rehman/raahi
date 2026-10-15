package pk.raahi.core.model

import java.time.DateTimeException
import java.time.LocalDate
import java.time.Year
import java.time.YearMonth
import java.time.temporal.ChronoUnit

/**
 * Age-limit arithmetic for job advertisements ("upper age limit 28 years as on the closing date").
 *
 * A direct port of the server's `lib/opportunities/age.ts`, checked against 77 vectors generated from it
 * (`contract/v1/vectors/age.json`). The advertisement's wording decides which reading applies, so both are reported:
 *  - by completed years: within a limit of N until the (N+1)th birthday;
 *  - to the day: within it only up to N years, 0 months, 0 days.
 * A 29 February birthday is counted on 1 March in years without a 29 February.
 */
data class AgeParts(val years: Int, val months: Int, val days: Int)

data class AgeCheckInput(
    val dob: LocalDate,
    val asOn: LocalDate,
    val maxYears: Int? = null,
    val relaxationYears: Int = 0,
    val minYears: Int? = null,
)

data class AgeCheck(
    val age: AgeParts,
    val limit: Int? = null,
    val withinByCompletedYears: Boolean? = null,
    val withinToTheDay: Boolean? = null,
    val meetsMinimum: Boolean? = null,
    val lastDayByCompletedYears: LocalDate? = null,
    val lastDayToTheDay: LocalDate? = null,
)

object AgeCalculator {
    private val isoDate = Regex("^\\d{4}-\\d{2}-\\d{2}$")

    /** A real calendar date in YYYY-MM-DD form, or null. */
    fun parseDate(text: String): LocalDate? {
        if (!isoDate.matches(text)) return null
        return try {
            LocalDate.parse(text)
        } catch (_: DateTimeException) {
            null
        }
    }

    private fun addMonths(born: LocalDate, months: Int): LocalDate {
        val index = born.monthValue - 1 + months
        val year = born.year + Math.floorDiv(index, 12)
        val month = Math.floorMod(index, 12) + 1
        if (born.monthValue == 2 && born.dayOfMonth == 29 && months % 12 == 0 && !Year.isLeap(year.toLong())) return LocalDate.of(year, 3, 1)
        return LocalDate.of(year, month, minOf(born.dayOfMonth, YearMonth.of(year, month).lengthOfMonth()))
    }

    private fun birthday(born: LocalDate, year: Int): LocalDate =
        if (born.monthValue == 2 && born.dayOfMonth == 29 && !Year.isLeap(year.toLong())) LocalDate.of(year, 3, 1)
        else LocalDate.of(year, born.monthValue, born.dayOfMonth)

    /** Completed years, months and days; null when the birth date is after the reference date. */
    fun ageOn(dob: LocalDate, asOn: LocalDate): AgeParts? {
        if (dob.isAfter(asOn)) return null
        var totalMonths = (asOn.year - dob.year) * 12 + (asOn.monthValue - dob.monthValue)
        if (addMonths(dob, totalMonths).isAfter(asOn)) totalMonths -= 1
        return AgeParts(totalMonths / 12, totalMonths % 12, ChronoUnit.DAYS.between(addMonths(dob, totalMonths), asOn).toInt())
    }

    fun check(input: AgeCheckInput): AgeCheck? {
        val age = ageOn(input.dob, input.asOn) ?: return null
        var limit: Int? = null
        var byYears: Boolean? = null
        var toTheDay: Boolean? = null
        var lastByYears: LocalDate? = null
        var lastToTheDay: LocalDate? = null
        input.maxYears?.takeIf { it >= 0 }?.let { max ->
            val effective = max + maxOf(0, input.relaxationYears)
            limit = effective
            byYears = age.years <= effective
            toTheDay = age.years < effective || (age.years == effective && age.months == 0 && age.days == 0)
            lastByYears = birthday(input.dob, input.dob.year + effective + 1).minusDays(1)
            lastToTheDay = birthday(input.dob, input.dob.year + effective)
        }
        val minimum = input.minYears?.takeIf { it >= 0 }?.let { age.years >= it }
        return AgeCheck(age, limit, byYears, toTheDay, minimum, lastByYears, lastToTheDay)
    }
}
