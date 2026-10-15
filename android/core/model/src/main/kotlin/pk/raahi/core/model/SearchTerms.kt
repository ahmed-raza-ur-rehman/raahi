package pk.raahi.core.model

/**
 * Turns what a person types into a safe full-text MATCH expression for the on-device index.
 *
 * Only letters and digits survive tokenisation, so no search-engine operator (`"`, `*`, `-`, `:`, `(`, `NEAR`...) a
 * user - or a pasted message - contains can change the meaning of the query. Every token is matched as a prefix.
 */
object SearchTerms {
    private val separators = Regex("[^\\p{L}\\p{N}]+")

    fun tokens(query: String, maxTokens: Int = 8): List<String> =
        separators.split(query.lowercase()).filter { it.isNotEmpty() }.distinct().take(maxTokens)

    /** `null` when there is nothing to search for. */
    fun toMatch(query: String): String? {
        val tokens = tokens(query)
        if (tokens.isEmpty()) return null
        return tokens.joinToString(" ") { if (it.length >= 2) "$it*" else it }
    }
}
