package pk.raahi.core.model

/** `major.minor.patch`, tolerant of a missing patch and of suffixes such as `-debug`. Used for the update gate. */
data class SemVer(val major: Int, val minor: Int, val patch: Int) : Comparable<SemVer> {
    override fun compareTo(other: SemVer): Int =
        compareValuesBy(this, other, SemVer::major, SemVer::minor, SemVer::patch)

    override fun toString(): String = "$major.$minor.$patch"

    companion object {
        private val pattern = Regex("^(\\d{1,4})(?:\\.(\\d{1,4}))?(?:\\.(\\d{1,4}))?")

        fun parse(text: String): SemVer? {
            val match = pattern.find(text.trim()) ?: return null
            val (major, minor, patch) = match.destructured
            return SemVer(major.toInt(), minor.ifEmpty { "0" }.toInt(), patch.ifEmpty { "0" }.toInt())
        }
    }
}
