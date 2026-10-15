package pk.raahi.core.model

import java.time.Instant
import java.time.LocalDate
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DomainLogicTest {
    private val now = Instant.parse("2026-10-15T08:00:00Z")

    private fun item(
        id: String,
        deadline: String? = null,
        rolling: Boolean = false,
        openToPakistan: Boolean? = null,
        scope: Scope = Scope.INTERNATIONAL,
        postedDaysAgo: Long = 1,
    ) = Opportunity(
        id = id, rev = "000000000000", kind = OpportunityKind.SCHOLARSHIP, scope = scope, title = "Title $id", url = "https://example.org/$id",
        sourceId = "src", sourceName = "Source", sourceUrl = "https://example.org", deadline = deadline?.let(LocalDate::parse), rolling = rolling,
        firstSeen = now.minusSeconds(postedDaysAgo * 86_400), lastSeen = now, postedAt = now.minusSeconds(postedDaysAgo * 86_400), openToPakistan = openToPakistan,
    )

    // ── tolerant reader ──────────────────────────────────────────────────────────

    @Test
    fun `REQ-AND-001 an unknown wire value never crashes an older app`() {
        assertEquals(OpportunityKind.UNKNOWN, OpportunityKind.fromWire("telepathy"))
        assertEquals(OpportunityKind.UNKNOWN, OpportunityKind.fromWire(null))
        assertEquals(OpportunityKind.JOB, OpportunityKind.fromWire("job"))
        assertEquals(Scope.INTERNATIONAL, Scope.fromWire("moon"))
        assertNull(Level.fromWire("kindergarten"))
        assertEquals(Funding.FULL, Funding.fromWire("full"))
    }

    // ── search terms ─────────────────────────────────────────────────────────────

    @Test
    fun `REQ-SEC-009 search terms contain only letters and digits, so no query operator can be injected`() {
        for (hostile in listOf("\"unterminated", "title:scholarship", "a OR b NEAR/3 c", "* * *", "-excluded", "' OR 1=1 --", "(((", "x\u0000y", "\u202Eevil")) {
            val match = SearchTerms.toMatch(hostile)
            if (match != null) assertTrue(Regex("^[\\p{L}\\p{N}* ]+$").matches(match), "unexpected characters in `$match`")
        }
        assertEquals("fully* funded* masters* germany*", SearchTerms.toMatch("Fully funded, MASTERS in Germany!!"))
        assertEquals("اسکالرشپ* برائے* طلبہ*", SearchTerms.toMatch("اسکالرشپ برائے طلبہ"))
        assertNull(SearchTerms.toMatch("   !!! ---  "))
        assertEquals(8, SearchTerms.tokens("a b c d e f g h i j k l").size, "the number of tokens is bounded")
    }

    @Test
    fun `REQ-SEC-009 fuzz - arbitrary text never produces an operator character`() {
        val random = Random(7)
        val alphabet = "abc XYZ 019 \"*():-+^~\\u0000\n\t\u202E.,;!?'ابج"
        repeat(2_000) {
            val text = buildString { repeat(random.nextInt(0, 40)) { append(alphabet[random.nextInt(alphabet.length)]) } }
            val match = SearchTerms.toMatch(text)
            if (match != null) assertTrue(Regex("^[\\p{L}\\p{N}* ]+$").matches(match), "text=${text.map { it.code }} match=$match")
        }
    }

    // ── URL policy ───────────────────────────────────────────────────────────────

    @Test
    fun `REQ-AND-009 only plain public web links are ever opened`() {
        for (safe in listOf("https://hec.gov.pk/scholarships", "http://old-portal.gov.pk/x?y=1", "https://exam.example.org:8443/a#b")) assertTrue(UrlPolicy.isSafeToOpen(safe), safe)
        for (unsafe in listOf(
            "javascript:alert(1)", "data:text/html,hi", "file:///etc/passwd", "intent://scan/#Intent;scheme=zxing;end", "content://x", "ftp://example.org/x",
            "https://user:pw@evil.example/", "https://trusted.org@evil.example/", "http://localhost/admin", "http://127.0.0.1:8080/", "http://[::1]/", "https://intranet/",
            "http://printer.local/", "https://", "", "   ", "https://exa mple.org", "https://example.org/\u0000", "https://" + "a".repeat(3000) + ".example/",
        )) assertFalse(UrlPolicy.isSafeToOpen(unsafe), "must not open: ${unsafe.take(60)}")
    }

    // ── versions ─────────────────────────────────────────────────────────────────

    @Test
    fun `REQ-AND-009 semantic versions parse tolerantly and compare numerically`() {
        assertEquals(SemVer(1, 2, 3), SemVer.parse("1.2.3"))
        assertEquals(SemVer(1, 2, 0), SemVer.parse("1.2"))
        assertEquals(SemVer(2, 0, 0), SemVer.parse("2"))
        assertEquals(SemVer(1, 0, 0), SemVer.parse("1.0.0-debug"))
        assertNull(SemVer.parse("abc"))
        assertTrue(SemVer.parse("1.10.0")!! > SemVer.parse("1.9.9")!!, "10 > 9 numerically, not as text")
        assertTrue(SemVer.parse("0.9.0")!! < SemVer.parse("1.0.0")!!)
    }

    // ── ranking ──────────────────────────────────────────────────────────────────

    @Test
    fun `REQ-AND-001 recommended order prefers a near deadline, openness to Pakistan and recency, and sinks excluded listings`() {
        val urgent = item("urgent", deadline = "2026-10-20", openToPakistan = true)
        val relaxed = item("relaxed", deadline = "2027-03-01")
        val excluded = item("excluded", deadline = "2026-10-20", openToPakistan = false)
        val old = item("old", postedDaysAgo = 200)
        val ordered = listOf(old, excluded, relaxed, urgent).sortedWith(Ranking.comparator(SortOrder.RECOMMENDED, now)).map { it.id }
        assertEquals("urgent", ordered.first())
        assertEquals("excluded", ordered.last(), "a listing that excludes Pakistan sinks")
        assertEquals(ordered, listOf(old, excluded, relaxed, urgent).sortedWith(Ranking.comparator(SortOrder.RECOMMENDED, now)).map { it.id }, "the order is deterministic")
    }

    @Test
    fun `REQ-AND-001 deadline order is ascending with undated listings last, newest order follows posting time`() {
        val a = item("a", deadline = "2026-12-01")
        val b = item("b", deadline = "2026-10-20")
        val c = item("c")
        assertEquals(listOf("b", "a", "c"), listOf(c, a, b).sortedWith(Ranking.comparator(SortOrder.DEADLINE, now)).map { it.id })
        val fresh = item("fresh", postedDaysAgo = 0)
        val stale = item("stale", postedDaysAgo = 30)
        assertEquals(listOf("fresh", "stale"), listOf(stale, fresh).sortedWith(Ranking.comparator(SortOrder.NEWEST, now)).map { it.id })
    }

    @Test
    fun `REQ-AND-001 status helpers agree with the model`() {
        val closingSoon = item("x", deadline = "2026-10-20")
        assertEquals(DeadlineStatus.CLOSING_SOON, closingSoon.statusAt(now).status)
        assertEquals(5, closingSoon.statusAt(now).daysLeft)
        assertNotNull(item("y", rolling = true).statusAt(now))
        assertEquals(DeadlineStatus.ROLLING, item("y", rolling = true).statusAt(now).status)
        assertEquals(LocalDate.parse("2026-10-15"), PakistanTime.today(now))
        assertEquals(LocalDate.parse("2026-10-16"), PakistanTime.today(Instant.parse("2026-10-15T19:00:00Z")))
    }

    @Test
    fun `REQ-AND-001 an empty filter has no active filters`() {
        assertFalse(OpportunityFilter().hasActiveFilters)
        assertTrue(OpportunityFilter(kinds = setOf(OpportunityKind.JOB)).hasActiveFilters)
        assertTrue(OpportunityFilter(includeClosed = true).hasActiveFilters)
    }
}
