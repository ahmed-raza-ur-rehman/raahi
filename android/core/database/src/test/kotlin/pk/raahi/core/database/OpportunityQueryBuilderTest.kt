package pk.raahi.core.database

import androidx.sqlite.db.SimpleSQLiteQuery
import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import pk.raahi.core.model.Funding
import pk.raahi.core.model.Level
import pk.raahi.core.model.OpportunityFilter
import pk.raahi.core.model.OpportunityKind
import pk.raahi.core.model.Scope

class OpportunityQueryBuilderTest {
    private val today = LocalDate.parse("2026-10-15")

    private fun build(filter: OpportunityFilter) = OpportunityQueryBuilder.build(filter, today) as SimpleSQLiteQuery

    private fun SimpleSQLiteQuery.arguments(): List<Any?> {
        val captured = mutableListOf<Any?>()
        bindTo(
            object : androidx.sqlite.db.SupportSQLiteProgram {
                override fun bindNull(index: Int) { captured.add(null) }
                override fun bindLong(index: Int, value: Long) { captured.add(value) }
                override fun bindDouble(index: Int, value: Double) { captured.add(value) }
                override fun bindString(index: Int, value: String) { captured.add(value) }
                override fun bindBlob(index: Int, value: ByteArray) { captured.add(value) }
                override fun clearBindings() = captured.clear()
                override fun close() = Unit
            },
        )
        return captured
    }

    @Test
    fun `[REQ-AND-001] the default query hides notices and closed listings and binds today as an argument`() {
        val query = build(OpportunityFilter())
        assertTrue(query.sql.contains("kind != 'notice'"))
        assertTrue(query.sql.contains("(deadline IS NULL OR deadline >= ?)"))
        assertEquals(listOf<Any?>("2026-10-15"), query.arguments())
    }

    @Test
    fun `[REQ-AND-001] every filter adds a bound condition and the argument order matches the placeholders`() {
        val query = build(
            OpportunityFilter(
                query = "fully funded", kinds = setOf(OpportunityKind.SCHOLARSHIP, OpportunityKind.FELLOWSHIP), scope = Scope.INTERNATIONAL,
                level = Level.MASTERS, funding = Funding.FULL, openToPakistanOnly = true, remoteOnly = true, closingWithinDays = 30,
            ),
        )
        assertEquals(query.sql.count { it == '?' }, query.arguments().size, "one argument per placeholder")
        assertEquals(
            listOf<Any?>("fully* funded*", "fellowship", "scholarship", "international", "%,masters,%", "full", "2026-10-15", "2026-10-15", "2026-11-14"),
            query.arguments(),
        )
        assertTrue(query.sql.contains("kind IN (?,?)") && !query.sql.contains("kind != 'notice'"), "asking for kinds replaces the notice rule")
    }

    @Test
    fun `[REQ-SEC-009] hostile text never reaches the SQL string`() {
        val hostile = listOf("'; DROP TABLE opportunities; --", "\" OR 1=1 --", "x') UNION SELECT * FROM saved --", "NEAR(a b)", "title:secret")
        for (text in hostile) {
            val query = build(OpportunityFilter(query = text))
            assertFalse(query.sql.contains("DROP") || query.sql.contains("UNION") || query.sql.contains("NEAR") || query.sql.contains("secret"), query.sql)
            assertEquals(query.sql.count { it == '?' }, query.arguments().size)
        }
    }

    @Test
    fun `[REQ-AND-001] the closing-soon window is clamped`() {
        val args = build(OpportunityFilter(closingWithinDays = 100_000)).arguments()
        assertEquals("2027-10-15", args.last())
    }
}
