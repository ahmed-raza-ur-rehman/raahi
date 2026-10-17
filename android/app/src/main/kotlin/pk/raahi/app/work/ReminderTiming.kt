package pk.raahi.app.work

import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset

/** Reminders go out at 09:00 Pakistan time: a sensible hour, and the same one the deadlines are counted in. */
object ReminderTiming {
    private val pakistan: ZoneOffset = ZoneOffset.ofHours(5)

    fun delayUntilNextNineAm(now: Instant): Duration {
        val local = now.atOffset(pakistan)
        var next = local.toLocalDate().atTime(9, 0).atOffset(pakistan)
        if (!next.toInstant().isAfter(now)) next = next.plusDays(1)
        return Duration.between(now, next.toInstant())
    }
}
