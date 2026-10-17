package pk.raahi.core.model

import java.time.Instant
import java.time.LocalDate
import java.time.temporal.ChronoUnit

data class SavedDeadline(val id: String, val title: String, val deadline: LocalDate, val reminderDays: Set<Int>)

data class Reminder(val key: String, val opportunityId: String, val title: String, val daysLeft: Int, val deadline: LocalDate)

/**
 * Decides which deadline reminders are due. Pure, so the rules are tested without WorkManager or notifications.
 *
 *  - A reminder "N days before" is due once the deadline is N days away or closer (not only on the exact day - a phone
 *    that was off that day must still be told).
 *  - Per listing only the TIGHTEST applicable reminder is sent, so someone who saves a listing 5 days from its deadline
 *    gets one notification, not one for every offset they configured.
 *  - Each (listing, offset, deadline) is sent once: [alreadySent] holds the keys already shown. A changed deadline is a
 *    new key, so a postponed deadline can remind again.
 *  - Past deadlines never remind.
 */
object ReminderPlanner {
    fun key(id: String, offset: Int, deadline: LocalDate) = "$id:$offset:$deadline"

    fun due(saved: List<SavedDeadline>, now: Instant, alreadySent: Set<String>): List<Reminder> {
        val today = PakistanTime.today(now)
        return saved.mapNotNull { item ->
            val daysLeft = ChronoUnit.DAYS.between(today, item.deadline).toInt()
            if (daysLeft < 0) return@mapNotNull null
            val offset = item.reminderDays.filter { it >= daysLeft }.minOrNull() ?: return@mapNotNull null
            val key = key(item.id, offset, item.deadline)
            if (key in alreadySent) null else Reminder(key, item.id, item.title, daysLeft, item.deadline)
        }.sortedWith(compareBy({ it.daysLeft }, { it.opportunityId }))
    }
}
