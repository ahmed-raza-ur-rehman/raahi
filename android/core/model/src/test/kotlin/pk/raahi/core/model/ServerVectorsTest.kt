package pk.raahi.core.model

import java.time.Instant
import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import pk.raahi.core.testing.Fixtures

/**
 * Cross-platform parity (REQ-AND-007): the server generated these vectors from its own implementation, and the app's
 * Kotlin port must reproduce every one. If either side changes the arithmetic, one of the two test suites fails.
 */
class ServerVectorsTest {
    private fun vectors(name: String) = Json.parseToJsonElement(Fixtures.text("vectors/$name")).jsonArray

    @Test
    fun `REQ-AND-007 age arithmetic reproduces every server vector`() {
        val all = vectors("age.json")
        assertTrue(all.size >= 70, "expected the full vector set, got ${all.size}")
        var rejected = 0
        for (vector in all) {
            val input = vector.jsonObject.getValue("input").jsonObject
            val dob = AgeCalculator.parseDate(input.getValue("dob").jsonPrimitive.content)
            val asOn = AgeCalculator.parseDate(input.getValue("asOn").jsonPrimitive.content)
            val actual = if (dob == null || asOn == null) null else AgeCalculator.check(
                AgeCheckInput(dob, asOn, input["maxYears"]?.jsonPrimitive?.intOrNull, input["relaxationYears"]?.jsonPrimitive?.intOrNull ?: 0, input["minYears"]?.jsonPrimitive?.intOrNull),
            )
            val expected = vector.jsonObject.getValue("expected")
            if (expected is JsonNull) {
                rejected += 1
                assertNull(actual, "$input must be rejected")
                continue
            }
            val e: JsonObject = expected.jsonObject
            assertNotNull(actual, "$input must be accepted")
            val age = e.getValue("age").jsonObject
            assertEquals(AgeParts(age.getValue("years").jsonPrimitive.int, age.getValue("months").jsonPrimitive.int, age.getValue("days").jsonPrimitive.int), actual.age, "age for $input")
            assertEquals(e["limit"]?.jsonPrimitive?.intOrNull, actual.limit, "limit for $input")
            assertEquals(e["withinByCompletedYears"]?.jsonPrimitive?.boolean, actual.withinByCompletedYears, "withinByCompletedYears for $input")
            assertEquals(e["withinToTheDay"]?.jsonPrimitive?.boolean, actual.withinToTheDay, "withinToTheDay for $input")
            assertEquals(e["meetsMinimum"]?.jsonPrimitive?.boolean, actual.meetsMinimum, "meetsMinimum for $input")
            assertEquals(e["lastDayByCompletedYears"]?.jsonPrimitive?.contentOrNull, actual.lastDayByCompletedYears?.toString(), "lastDayByCompletedYears for $input")
            assertEquals(e["lastDayToTheDay"]?.jsonPrimitive?.contentOrNull, actual.lastDayToTheDay?.toString(), "lastDayToTheDay for $input")
        }
        assertTrue(rejected >= 2, "the rejected-input vectors must be exercised")
    }

    @Test
    fun `REQ-AND-007 deadline status reproduces every server vector including the Pakistan midnight boundary`() {
        val all = vectors("status.json")
        assertTrue(all.size >= 90)
        for (vector in all) {
            val v = vector.jsonObject
            val now = Instant.parse(v.getValue("now").jsonPrimitive.content)
            val deadline = v.getValue("deadline").jsonPrimitive.contentOrNull?.let(LocalDate::parse)
            val rolling = v.getValue("rolling").jsonPrimitive.boolean
            val expected = v.getValue("expected").jsonObject
            val actual = statusOf(deadline, rolling, now)
            val label = "now=$now deadline=$deadline rolling=$rolling"
            assertEquals(expected.getValue("status").jsonPrimitive.content, wire(actual.status), label)
            assertEquals(expected["daysLeft"]?.jsonPrimitive?.intOrNull, actual.daysLeft, label)
        }
    }

    @Test
    fun `REQ-AND-007 the new badge reproduces the server vectors`() {
        for (vector in vectors("is-new.json")) {
            val v = vector.jsonObject
            val now = Instant.parse(v.getValue("now").jsonPrimitive.content)
            val firstSeen = Instant.parse(v.getValue("firstSeen").jsonPrimitive.content)
            assertEquals(v.getValue("expected").jsonPrimitive.boolean, isNew(firstSeen, now), "firstSeen=$firstSeen now=$now")
        }
    }

    private fun wire(status: DeadlineStatus) = when (status) {
        DeadlineStatus.OPEN -> "open"
        DeadlineStatus.CLOSING_SOON -> "closing-soon"
        DeadlineStatus.CLOSED -> "closed"
        DeadlineStatus.ROLLING -> "rolling"
        DeadlineStatus.UNKNOWN -> "unknown"
    }
}
