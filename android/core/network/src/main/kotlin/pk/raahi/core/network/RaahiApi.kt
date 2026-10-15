package pk.raahi.core.network

/** The read side of the v1 API plus the one credentialed tool the app uses (scam check). */
interface RaahiApi {
    suspend fun meta(): ApiResult<MetaResponseDto>

    /** Step one of delta sync. Pass the previous ETag to get [ApiResult.NotModified] when nothing changed. */
    suspend fun manifest(ifNoneMatch: String?): ApiResult<ManifestResponseDto>

    /** Step two of delta sync: at most [BATCH_MAX] ids per call. */
    suspend fun batch(ids: List<String>): ApiResult<BatchResponseDto>

    suspend fun programmes(language: String, query: String? = null): ApiResult<ProgrammeListDto>

    suspend fun guides(language: String): ApiResult<GuideListDto>

    suspend fun guide(id: String, language: String): ApiResult<GuideDetailResponseDto>

    suspend fun resources(language: String, category: String? = null): ApiResult<ResourceListDto>

    suspend fun scamCheck(request: ScamRequestDto): ApiResult<ScamResponseDto>

    companion object {
        const val BATCH_MAX = 50
    }
}

class DefaultRaahiApi(private val transport: ApiTransport, private val tokens: TokenProvider? = null) : RaahiApi {
    override suspend fun meta() = transport.get("api/v1/meta", serializer = MetaResponseDto.serializer(), token = tokens?.cached())

    override suspend fun manifest(ifNoneMatch: String?) =
        transport.get("api/v1/opportunities/manifest", serializer = ManifestResponseDto.serializer(), etag = ifNoneMatch, token = tokens?.cached())

    override suspend fun batch(ids: List<String>): ApiResult<BatchResponseDto> {
        require(ids.size in 1..RaahiApi.BATCH_MAX) { "A batch holds 1..${RaahiApi.BATCH_MAX} ids" }
        return transport.get("api/v1/opportunities/batch", listOf("ids" to ids.joinToString(",")), BatchResponseDto.serializer(), token = tokens?.cached())
    }

    override suspend fun programmes(language: String, query: String?) =
        transport.get("api/v1/programmes", listOfNotNull("lang" to language, query?.takeIf { it.isNotBlank() }?.let { "q" to it.take(200) }), ProgrammeListDto.serializer(), token = tokens?.cached())

    override suspend fun guides(language: String) =
        transport.get("api/v1/guides", listOf("lang" to language), GuideListDto.serializer(), token = tokens?.cached())

    override suspend fun guide(id: String, language: String) =
        transport.get("api/v1/guides/$id", listOf("lang" to language), GuideDetailResponseDto.serializer(), token = tokens?.cached())

    override suspend fun resources(language: String, category: String?) =
        transport.get("api/v1/resources", listOfNotNull("lang" to language, category?.let { "category" to it }, "limit" to "100"), ResourceListDto.serializer(), token = tokens?.cached())

    override suspend fun scamCheck(request: ScamRequestDto): ApiResult<ScamResponseDto> {
        val provider = tokens ?: return ApiResult.Failure(ApiError.Unauthorized(expired = false))
        suspend fun attempt(token: String) = transport.post("api/v1/tools/scam-check", request, ScamRequestDto.serializer(), ScamResponseDto.serializer(), token)
        val first = provider.token() ?: return ApiResult.Failure(ApiError.Unauthorized(expired = false))
        val result = attempt(first)
        if (result is ApiResult.Failure && result.error is ApiError.Unauthorized && result.error.expired) {
            val fresh = provider.token(forceRefresh = true) ?: return result
            return attempt(fresh)
        }
        return result
    }
}

class DefaultAuthApi(private val transport: ApiTransport) : AuthApi {
    override suspend fun challenge() = transport.get("api/v1/auth/challenge", serializer = ChallengeDto.serializer())

    override suspend fun register(request: DeviceRequestDto) =
        transport.post("api/v1/auth/device", request, DeviceRequestDto.serializer(), DeviceResponseDto.serializer())
}
