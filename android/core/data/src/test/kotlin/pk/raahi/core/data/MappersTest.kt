package pk.raahi.core.data

import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import pk.raahi.core.model.Funding
import pk.raahi.core.model.Level
import pk.raahi.core.model.OpportunityKind
import pk.raahi.core.model.Scope

class MappersTest {
    @Test
    fun `REQ-AND-001 every server listing maps to the domain model and survives a round trip through the database row`() {
        val dtos = fixtureItems(1) + fixtureItems(2)
        for (dto in dtos) {
            val domain = assertNotNull(dto.toDomainOrNull(), dto.id)
            assertEquals(dto.id, domain.id)
            assertEquals(dto.rev, domain.rev)
            assertEquals(dto.title, domain.title)
            assertEquals(domain, domain.toEntity().toDomain(), "entity round trip for ${dto.id}")
        }
        assertTrue(dtos.size >= 20)
    }

    @Test
    fun `REQ-AND-001 wire values map tolerantly - an unknown kind or scope never crashes, unknown levels are dropped`() {
        val base = fixtureItems(1).first()
        val future = base.copy(kind = "telepathy", scope = "mars", levels = listOf("masters", "kindergarten"), funding = "lottery").toDomainOrNull()!!
        assertEquals(OpportunityKind.UNKNOWN, future.kind)
        assertEquals(Scope.INTERNATIONAL, future.scope)
        assertEquals(listOf(Level.MASTERS), future.levels)
        assertNull(future.funding)
        assertEquals(Funding.FULL, base.copy(funding = "full").toDomainOrNull()!!.funding)
    }

    @Test
    fun `REQ-AND-002 a record with an unparseable date is rejected as a whole rather than guessed at`() {
        val base = fixtureItems(1).first()
        assertNull(base.copy(deadline = "2026-02-31").toDomainOrNull())
        assertNull(base.copy(firstSeen = "yesterday").toDomainOrNull())
        assertEquals(LocalDate.parse("2026-12-01"), base.copy(deadline = "2026-12-01").toDomainOrNull()!!.deadline)
    }

    @Test
    fun `REQ-AND-001 the row keeps levels in the exact comma-delimited form the SQL relies on`() {
        val row = fixtureItems(1).first().copy(levels = listOf("masters", "phd")).toDomainOrNull()!!.toEntity()
        assertEquals(",masters,phd,", row.levels)
        assertEquals(",", fixtureItems(1).first().copy(levels = emptyList()).toDomainOrNull()!!.toEntity().levels)
    }
}
