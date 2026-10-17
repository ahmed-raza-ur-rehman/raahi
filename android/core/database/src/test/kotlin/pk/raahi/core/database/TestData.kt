package pk.raahi.core.database

import java.time.Instant

internal val T0: Instant = Instant.parse("2026-10-15T08:00:00Z")

internal fun entity(
    id: String,
    title: String = "Title $id",
    kind: String = "scholarship",
    scope: String = "international",
    organization: String? = null,
    summary: String? = null,
    country: String? = null,
    levels: String = ",masters,",
    funding: String? = null,
    deadline: String? = null,
    openToPakistan: Boolean? = null,
    remote: Boolean? = null,
    location: String? = null,
    tags: String = "[]",
) = OpportunityEntity(
    id = id, rev = "rev-$id", kind = kind, scope = scope, title = title, organization = organization, summary = summary,
    url = "https://example.org/$id", applyUrl = null, sourceId = "src", sourceName = "Source", sourceUrl = "https://example.org",
    country = country, location = location, remote = remote, levels = levels, fields = "[]", tags = tags, funding = funding,
    deadline = deadline, deadlineText = null, rolling = false, postedAt = T0.toEpochMilli(), startsAt = null,
    firstSeen = T0.toEpochMilli(), lastSeen = T0.toEpochMilli(), openToPakistan = openToPakistan, eligibilityNote = null,
    languages = "[]", alsoOn = "[]",
)

internal fun OpportunityEntity.toFts() =
    OpportunityFts(id, title, organization.orEmpty(), summary.orEmpty(), tags, country.orEmpty())
