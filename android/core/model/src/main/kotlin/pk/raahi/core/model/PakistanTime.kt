package pk.raahi.core.model

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * Deadlines are calendar dates in Pakistan (UTC+5, no daylight saving). A listing that closes on 15 October is open
 * until midnight in Pakistan, whatever the phone's own time zone says - the same rule the server applies, so the
 * app and the website never disagree about "days left".
 */
object PakistanTime {
    private val offset: ZoneOffset = ZoneOffset.ofHours(5)

    fun today(now: Instant): LocalDate = now.atOffset(offset).toLocalDate()
}
