package pk.raahi.core.testing

/** Reads the golden contract fixtures (`contract/v1/**` at the repository root). */
object Fixtures {
    fun text(path: String): String {
        val stream = checkNotNull(Fixtures::class.java.getResourceAsStream("/v1/$path")) {
            "Missing contract fixture v1/$path - run `npm run contract:write` at the repository root."
        }
        return stream.bufferedReader(Charsets.UTF_8).use { it.readText() }
    }
}
