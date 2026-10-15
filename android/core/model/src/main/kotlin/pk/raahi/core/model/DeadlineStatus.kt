package pk.raahi.core.model

import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.ChronoUnit

enum class DeadlineStatus { OPEN, CLOSING_SOON, CLOSED, ROLLING, UNKNOWN }

data class StatusInfo(val status: DeadlineStatus, val daysLeft: Int?)

const val CLOSING_SOON_DAYS = 7
const val NEW_WITHIN_DAYS = 3

/**
 * Status and days left, computed on the device so an offline app is still right tomorrow. Mirrors the server's
 * `computeStatus`; `contract/v1/vectors/status.json` (generated from the server) is checked in this module's tests.
 */
fun statusOf(deadline: LocalDate?, rolling: Boolean, now: Instant): StatusInfo {
    if (deadline != null) {
        val daysLeft = ChronoUnit.DAYS.between(PakistanTime.today(now), deadline).toInt()
        return when {
            daysLeft < 0 -> StatusInfo(DeadlineStatus.CLOSED, daysLeft)
            daysLeft <= CLOSING_SOON_DAYS -> StatusInfo(DeadlineStatus.CLOSING_SOON, daysLeft)
            else -> StatusInfo(DeadlineStatus.OPEN, daysLeft)
        }
    }
    if (rolling) return StatusInfo(DeadlineStatus.ROLLING, null)
    return StatusInfo(DeadlineStatus.UNKNOWN, null)
}

fun Opportunity.statusAt(now: Instant): StatusInfo = statusOf(deadline, rolling, now)

/** First seen within the last [withinDays] days (inclusive), like the server's "new" badge. */
fun isNew(firstSeen: Instant, now: Instant, withinDays: Int = NEW_WITHIN_DAYS): Boolean =
    Duration.between(firstSeen, now).toMillis() <= withinDays * 86_400_000L
