package pk.raahi.core.database

import androidx.sqlite.db.SimpleSQLiteQuery
import androidx.sqlite.db.SupportSQLiteQuery
import java.time.LocalDate
import pk.raahi.core.model.OpportunityFilter
import pk.raahi.core.model.SearchTerms

/**
 * Turns an [OpportunityFilter] into SQL. Every value from the person is bound as an argument; the only text placed in
 * the statement is fixed by this file, so no input can change what the query does. Ordering is applied afterwards in
 * Kotlin (core.model.Ranking) because "recommended" is a score, not a column.
 */
object OpportunityQueryBuilder {
    fun build(filter: OpportunityFilter, today: LocalDate): SupportSQLiteQuery {
        val where = mutableListOf<String>()
        val args = mutableListOf<Any?>()

        SearchTerms.toMatch(filter.query)?.let { match ->
            where.add("id IN (SELECT id FROM opportunity_fts WHERE opportunity_fts MATCH ?)")
            args.add(match)
        }
        if (filter.kinds.isNotEmpty()) {
            where.add("kind IN (${filter.kinds.joinToString(",") { "?" }})")
            args.addAll(filter.kinds.map { it.wire }.sorted())
        } else {
            // Regulator notices are alerts, not opportunities: shown only when asked for (same rule as the website).
            where.add("kind != 'notice'")
        }
        filter.scope?.let { scope ->
            where.add("scope = ?")
            args.add(scope.wire)
        }
        filter.level?.let { level ->
            where.add("levels LIKE ?")
            args.add("%,${level.wire},%")
        }
        filter.funding?.let { funding ->
            where.add("funding = ?")
            args.add(funding.wire)
        }
        if (filter.openToPakistanOnly) where.add("(openToPakistan IS NULL OR openToPakistan = 1)")
        if (filter.remoteOnly) where.add("(remote = 1 OR location = 'Online')")
        if (!filter.includeClosed) {
            where.add("(deadline IS NULL OR deadline >= ?)")
            args.add(today.toString())
        }
        filter.closingWithinDays?.let { days ->
            where.add("(deadline IS NOT NULL AND deadline >= ? AND deadline <= ?)")
            args.add(today.toString())
            args.add(today.plusDays(days.coerceIn(0, 365).toLong()).toString())
        }

        return SimpleSQLiteQuery("SELECT * FROM opportunities WHERE ${where.joinToString(" AND ")}", args.toTypedArray())
    }
}
