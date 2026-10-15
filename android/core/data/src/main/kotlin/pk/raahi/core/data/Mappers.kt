package pk.raahi.core.data

import java.time.DateTimeException
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import pk.raahi.core.database.OpportunityEntity
import pk.raahi.core.database.OpportunityFts
import pk.raahi.core.model.AlsoOn
import pk.raahi.core.model.Funding
import pk.raahi.core.model.Level
import pk.raahi.core.model.Opportunity
import pk.raahi.core.model.OpportunityKind
import pk.raahi.core.model.Scope
import pk.raahi.core.network.OpportunityDto

private val json = Json { ignoreUnknownKeys = true }
private val stringList = ListSerializer(String.serializer())

private fun parseInstant(text: String): Instant = OffsetDateTime.parse(text).toInstant()

private fun parseDate(text: String?): LocalDate? = text?.let { LocalDate.parse(it) }

/**
 * Network -> domain. Returns null for a listing that cannot be understood (a malformed date, say): one bad record must
 * never abort the whole synchronisation (the "poison pill" problem), so the caller skips it and counts it.
 */
fun OpportunityDto.toDomainOrNull(): Opportunity? = try {
    Opportunity(
        id = id,
        rev = rev,
        kind = OpportunityKind.fromWire(kind),
        scope = Scope.fromWire(scope),
        title = title,
        organization = organization,
        summary = summary,
        url = url,
        applyUrl = applyUrl,
        sourceId = source.id,
        sourceName = source.name,
        sourceUrl = source.url,
        country = country,
        location = location,
        remote = remote,
        levels = levels.mapNotNull(Level::fromWire),
        fields = fields,
        tags = tags,
        funding = Funding.fromWire(funding),
        deadline = parseDate(deadline),
        deadlineText = deadlineText,
        rolling = rolling == true,
        postedAt = postedAt?.let(::parseInstant),
        startsAt = parseDate(startsAt),
        firstSeen = parseInstant(firstSeen),
        lastSeen = parseInstant(lastSeen),
        openToPakistan = openToPakistan,
        eligibilityNote = eligibilityNote,
        languages = languages.orEmpty(),
        alsoOn = alsoOn.orEmpty().map { AlsoOn(it.sourceName, it.url) },
    )
} catch (_: DateTimeException) {
    null
}

fun Opportunity.toEntity(): OpportunityEntity = OpportunityEntity(
    id = id,
    rev = rev,
    kind = kind.wire,
    scope = scope.wire,
    title = title,
    organization = organization,
    summary = summary,
    url = url,
    applyUrl = applyUrl,
    sourceId = sourceId,
    sourceName = sourceName,
    sourceUrl = sourceUrl,
    country = country,
    location = location,
    remote = remote,
    levels = levels.joinToString(separator = ",", prefix = ",", postfix = ",") { it.wire },
    fields = json.encodeToString(stringList, fields),
    tags = json.encodeToString(stringList, tags),
    funding = funding?.wire,
    deadline = deadline?.toString(),
    deadlineText = deadlineText,
    rolling = rolling,
    postedAt = postedAt?.toEpochMilli(),
    startsAt = startsAt?.toString(),
    firstSeen = firstSeen.toEpochMilli(),
    lastSeen = lastSeen.toEpochMilli(),
    openToPakistan = openToPakistan,
    eligibilityNote = eligibilityNote,
    languages = json.encodeToString(stringList, languages),
    alsoOn = json.encodeToString(stringList, alsoOn.flatMap { listOf(it.sourceName, it.url) }),
    stale = stale,
)

fun Opportunity.toFts(): OpportunityFts =
    OpportunityFts(id, title, organization.orEmpty(), summary.orEmpty(), tags.joinToString(" "), country.orEmpty())

fun OpportunityEntity.toDomain(): Opportunity = Opportunity(
    id = id,
    rev = rev,
    kind = OpportunityKind.fromWire(kind),
    scope = Scope.fromWire(scope),
    title = title,
    organization = organization,
    summary = summary,
    url = url,
    applyUrl = applyUrl,
    sourceId = sourceId,
    sourceName = sourceName,
    sourceUrl = sourceUrl,
    country = country,
    location = location,
    remote = remote,
    levels = levels.split(',').filter { it.isNotEmpty() }.mapNotNull(Level::fromWire),
    fields = decodeList(fields),
    tags = decodeList(tags),
    funding = Funding.fromWire(funding),
    deadline = parseDate(deadline),
    deadlineText = deadlineText,
    rolling = rolling,
    postedAt = postedAt?.let(Instant::ofEpochMilli),
    startsAt = parseDate(startsAt),
    firstSeen = Instant.ofEpochMilli(firstSeen),
    lastSeen = Instant.ofEpochMilli(lastSeen),
    openToPakistan = openToPakistan,
    eligibilityNote = eligibilityNote,
    languages = decodeList(languages),
    alsoOn = decodeList(alsoOn).chunked(2).filter { it.size == 2 }.map { AlsoOn(it[0], it[1]) },
    stale = stale,
)

private fun decodeList(text: String): List<String> = runCatching { json.decodeFromString(stringList, text) }.getOrDefault(emptyList())
