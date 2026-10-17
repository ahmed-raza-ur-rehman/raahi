package pk.raahi.app

import java.time.Duration
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import pk.raahi.app.work.ReminderTiming

class ReminderTimingTest {
    private fun hoursUntil(now: String) = ReminderTiming.delayUntilNextNineAm(Instant.parse(now)).toMinutes() / 60.0

    @Test
    fun `REQ-AND-006 reminders go out at nine in the morning Pakistan time`() {
        assertEquals(1.0, hoursUntil("2026-10-15T03:00:00Z"), "08:00 in Pakistan: one hour to go")
        assertEquals(22.0, hoursUntil("2026-10-15T06:00:00Z"), "11:00 in Pakistan: tomorrow at 09:00")
        assertEquals(10.0, hoursUntil("2026-10-15T18:00:00Z"), "23:00 in Pakistan")
        assertEquals(24.0, hoursUntil("2026-10-15T04:00:00Z"), "exactly 09:00 schedules the next day, never zero")
    }

    @Test
    fun `REQ-AND-006 the delay is always positive and never longer than a day`() {
        var instant = Instant.parse("2026-01-01T00:00:00Z")
        repeat(500) {
            val delay = ReminderTiming.delayUntilNextNineAm(instant)
            assertTrue(delay > Duration.ZERO && delay <= Duration.ofDays(1), "$instant -> $delay")
            instant = instant.plusSeconds(7_919)
        }
    }
}

class CertPinsTest {
    private val pin1 = "sha256/" + "A".repeat(43) + "="
    private val pin2 = "sha256/" + "B".repeat(43) + "="

    @Test
    fun `REQ-AND-004 no pinning by default`() {
        assertTrue(CertPins.parse("").isEmpty())
        assertTrue(CertPins.parse("   ").isEmpty())
    }

    @Test
    fun `REQ-AND-004 pins need a backup, a valid host and valid hashes - anything else is dropped`() {
        val parsed = CertPins.parse("raahi-phi.vercel.app=$pin1|$pin2; api.example.org=$pin1|$pin2")
        assertEquals(setOf("raahi-phi.vercel.app", "api.example.org"), parsed.keys)
        assertEquals(listOf(pin1, pin2), parsed.getValue("raahi-phi.vercel.app"))
        assertTrue(CertPins.parse("a.example.org=$pin1").isEmpty(), "a single pin would lock users out when the certificate rotates")
        assertTrue(CertPins.parse("a.example.org=$pin1|sha256/short").isEmpty())
        assertTrue(CertPins.parse("localhost=$pin1|$pin2").isEmpty(), "single-label hosts are not pinned")
        assertTrue(CertPins.parse("not a host=$pin1|$pin2").isEmpty())
        assertTrue(CertPins.parse("=$pin1|$pin2;nohost").isEmpty())
    }
}
