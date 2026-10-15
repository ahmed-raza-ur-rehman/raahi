package pk.raahi.core.model

import java.time.Instant
import java.time.LocalDate

/*
 * The app's own vocabulary. Wire values are mapped with a TOLERANT reader: a value the app does not know (the server
 * may add a new kind next year) becomes UNKNOWN instead of crashing an older installed app.
 */

enum class OpportunityKind(val wire: String) {
    SCHOLARSHIP("scholarship"),
    FELLOWSHIP("fellowship"),
    INTERNSHIP("internship"),
    JOB("job"),
    COMPETITION("competition"),
    COURSE("course"),
    COUPON("coupon"),
    TRAINING("training"),
    GRANT("grant"),
    ADMISSION("admission"),
    NOTICE("notice"),
    UNKNOWN("unknown"),
    ;

    companion object {
        fun fromWire(value: String?): OpportunityKind = entries.firstOrNull { it.wire == value } ?: UNKNOWN
    }
}

enum class Scope(val wire: String) {
    PAKISTAN("pakistan"),
    INTERNATIONAL("international"),
    ;

    companion object {
        fun fromWire(value: String?): Scope = entries.firstOrNull { it.wire == value } ?: INTERNATIONAL
    }
}

enum class Level(val wire: String) {
    SCHOOL("school"),
    UNDERGRADUATE("undergraduate"),
    MASTERS("masters"),
    PHD("phd"),
    POSTDOC("postdoc"),
    PROFESSIONAL("professional"),
    ANY("any"),
    ;

    companion object {
        fun fromWire(value: String?): Level? = entries.firstOrNull { it.wire == value }
    }
}

enum class Funding(val wire: String) {
    FULL("full"),
    PARTIAL("partial"),
    STIPEND("stipend"),
    PAID("paid"),
    FREE("free"),
    UNKNOWN("unknown"),
    ;

    companion object {
        fun fromWire(value: String?): Funding? = entries.firstOrNull { it.wire == value }
    }
}

/** One listing, as stored on the device. */
data class Opportunity(
    val id: String,
    /** Content revision from the server; changes only when the listing's content changes (the sync key). */
    val rev: String,
    val kind: OpportunityKind,
    val scope: Scope,
    val title: String,
    val organization: String? = null,
    val summary: String? = null,
    val url: String,
    val applyUrl: String? = null,
    val sourceId: String,
    val sourceName: String,
    val sourceUrl: String,
    val country: String? = null,
    val location: String? = null,
    val remote: Boolean? = null,
    val levels: List<Level> = emptyList(),
    val fields: List<String> = emptyList(),
    val tags: List<String> = emptyList(),
    val funding: Funding? = null,
    val deadline: LocalDate? = null,
    val deadlineText: String? = null,
    val rolling: Boolean = false,
    val postedAt: Instant? = null,
    val startsAt: LocalDate? = null,
    val firstSeen: Instant,
    val lastSeen: Instant,
    /** null = the listing does not say. */
    val openToPakistan: Boolean? = null,
    val eligibilityNote: String? = null,
    val languages: List<String> = emptyList(),
    val alsoOn: List<AlsoOn> = emptyList(),
)

data class AlsoOn(val sourceName: String, val url: String)

enum class SortOrder { RECOMMENDED, DEADLINE, NEWEST }

/** What the person asked to see. All filtering happens on the device, against the synchronised data set. */
data class OpportunityFilter(
    val query: String = "",
    val kinds: Set<OpportunityKind> = emptySet(),
    val scope: Scope? = null,
    val level: Level? = null,
    val funding: Funding? = null,
    val openToPakistanOnly: Boolean = false,
    val remoteOnly: Boolean = false,
    val closingWithinDays: Int? = null,
    val includeClosed: Boolean = false,
    val sort: SortOrder = SortOrder.RECOMMENDED,
) {
    val hasActiveFilters: Boolean
        get() = kinds.isNotEmpty() || scope != null || level != null || funding != null || openToPakistanOnly || remoteOnly ||
            closingWithinDays != null || includeClosed
}
