package pk.raahi.core.model

import java.time.Instant
import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ReminderPlannerTest {
    private val now = Instant.parse("2026-10-15T08:00:00Z") // 15 October in Pakistan
    private fun saved(id: String, deadline: String, vararg offsets: Int) = SavedDeadline(id, "Title $id", LocalDate.parse(deadline), offsets.toSet())

    @Test
    fun `REQ-AND-006 a reminder is due once the deadline is that many days away or closer`() {
        val due = ReminderPlanner.due(listOf(saved("a", "2026-10-22", 7, 1)), now, emptySet())
        assertEquals(listOf(7), due.map { it.daysLeft })
        assertEquals("a:7:2026-10-22", due.single().key)
        assertTrue(ReminderPlanner.due(listOf(saved("a", "2026-10-23", 7, 1)), now, emptySet()).isEmpty(), "8 days away: not yet")
    }

    @Test
    fun `REQ-AND-006 only the tightest applicable reminder is sent, so saving late gives one notification not several`() {
        val due = ReminderPlanner.due(listOf(saved("a", "2026-10-16", 7, 3, 1)), now, emptySet())
        assertEquals(1, due.size)
        assertEquals("a:1:2026-10-16", due.single().key)
        assertEquals(1, due.single().daysLeft)
    }

    @Test
    fun `REQ-AND-006 a reminder is sent once, a postponed deadline can remind again`() {
        val first = ReminderPlanner.due(listOf(saved("a", "2026-10-16", 1)), now, emptySet())
        val sent = first.map { it.key }.toSet()
        assertTrue(ReminderPlanner.due(listOf(saved("a", "2026-10-16", 1)), now, sent).isEmpty())
        val postponed = ReminderPlanner.due(listOf(saved("a", "2026-10-17", 3)), now, sent)
        assertEquals(1, postponed.size, "a different deadline is a different key")
    }

    @Test
    fun `REQ-AND-006 missed days are caught up and past deadlines never remind`() {
        val due = ReminderPlanner.due(listOf(saved("late", "2026-10-15", 7, 1), saved("past", "2026-10-14", 7, 1)), now, emptySet())
        assertEquals(listOf("late"), due.map { it.opportunityId })
        assertEquals(0, due.single().daysLeft, "closing today still reminds")
    }

    @Test
    fun `REQ-AND-006 the Pakistan calendar decides the day, not the phone's time zone`() {
        val justBeforeMidnightPk = Instant.parse("2026-10-15T18:59:59Z")
        val justAfter = Instant.parse("2026-10-15T19:00:00Z")
        assertEquals(1, ReminderPlanner.due(listOf(saved("a", "2026-10-15", 1)), justBeforeMidnightPk, emptySet()).size)
        assertTrue(ReminderPlanner.due(listOf(saved("a", "2026-10-15", 1)), justAfter, emptySet()).isEmpty(), "after midnight in Pakistan the deadline day has passed")
    }

    @Test
    fun `REQ-AND-006 output order is stable - most urgent first`() {
        val due = ReminderPlanner.due(listOf(saved("z", "2026-10-20", 7), saved("a", "2026-10-16", 7), saved("m", "2026-10-16", 7)), now, emptySet())
        assertEquals(listOf("a", "m", "z"), due.map { it.opportunityId })
    }
}
