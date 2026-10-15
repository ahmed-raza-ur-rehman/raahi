package pk.raahi.core.model

import java.time.Duration
import java.time.Instant
import kotlin.math.exp

/**
 * Ordering of the list. "Recommended" follows the same ideas as the website's ranking without the full-text score:
 * recent listings, deadlines that are close but not missed, listings open to Pakistan, and Pakistani listings.
 */
object Ranking {
    fun score(item: Opportunity, now: Instant): Double {
        val reference = item.postedAt ?: item.firstSeen
        val ageDays = maxOf(0.0, Duration.between(reference, now).toMillis() / 86_400_000.0)
        var score = exp(-ageDays / 30.0)
        val daysLeft = item.statusAt(now).daysLeft
        if (daysLeft != null && daysLeft in 0..14) score += 0.6 * (1 - daysLeft / 14.0)
        when (item.openToPakistan) {
            true -> score += 0.4
            false -> score -= 1.0
            null -> Unit
        }
        if (item.scope == Scope.PAKISTAN) score += 0.2
        return score
    }

    fun comparator(sort: SortOrder, now: Instant): Comparator<Opportunity> = when (sort) {
        SortOrder.RECOMMENDED -> compareByDescending<Opportunity> { score(it, now) }.thenBy { it.id }
        SortOrder.NEWEST -> compareByDescending<Opportunity> { it.postedAt ?: it.firstSeen }.thenBy { it.id }
        SortOrder.DEADLINE -> Comparator { a, b ->
            val da = a.deadline
            val db = b.deadline
            when {
                da != null && db != null -> da.compareTo(db).takeIf { it != 0 } ?: a.id.compareTo(b.id)
                da != null -> -1
                db != null -> 1
                else -> score(b, now).compareTo(score(a, now)).takeIf { it != 0 } ?: a.id.compareTo(b.id)
            }
        }
    }
}
