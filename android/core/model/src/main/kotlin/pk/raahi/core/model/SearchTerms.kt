package pk.raahi.core.model

/**
 * Turns what a person types into a safe full-text MATCH expression for the on-device index.
 *
 * Only letters and digits survive tokenisation, so no search-engine operator (`"`, `*`, `-`, `:`, `(`, `NEAR`...) a
 * user - or a pasted message - contains can change the meaning of the query. Every token is matched as a prefix.
 */
object SearchTerms {
    private val separators = Regex("[^\\p{L}\\p{N}]+")

    /**
     * Filler words of a natural sentence ("masters IN germany", "jobs FOR women"). Matched as required prefixes they would
     * wrongly exclude good listings, so they are dropped - unless the whole query is filler, in which case it is kept.
     */
    private val filler = setOf(
        "a", "an", "the", "in", "on", "at", "of", "for", "to", "and", "or", "with", "from", "by", "is", "are", "me", "my", "i", "near", "about",
        "کے", "کی", "کا", "میں", "سے", "کو", "اور", "ہے", "پر", "لیے", "لئے",
    )

    fun tokens(query: String, maxTokens: Int = 8): List<String> {
        val all = separators.split(query.lowercase()).filter { it.isNotEmpty() }.distinct()
        val meaningful = all.filterNot { it in filler }
        return (meaningful.ifEmpty { all }).take(maxTokens)
    }

    /** `null` when there is nothing to search for. */
    fun toMatch(query: String): String? {
        val tokens = tokens(query)
        if (tokens.isEmpty()) return null
        return tokens.joinToString(" ") { if (it.length >= 2) "$it*" else it }
    }
}
