package pk.raahi.app

import android.content.Context
import android.os.Build
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.preferencesDataStoreFile
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import okhttp3.HttpUrl.Companion.toHttpUrl
import pk.raahi.app.work.WorkScheduler
import pk.raahi.core.data.AppLanguage
import pk.raahi.core.data.DataStoreSettingsStore
import pk.raahi.core.data.DefaultOpportunityRepository
import pk.raahi.core.data.DocumentRepository
import pk.raahi.core.data.DocumentSource
import pk.raahi.core.data.OpportunityRepository
import pk.raahi.core.data.RoomOpportunityStore
import pk.raahi.core.data.RoomSyncStateStore
import pk.raahi.core.data.SettingsStore
import pk.raahi.core.data.SyncEngine
import pk.raahi.core.data.TimeSource
import pk.raahi.core.database.RaahiDatabase
import pk.raahi.core.model.SemVer
import pk.raahi.core.network.ApiTransport
import pk.raahi.core.network.DefaultAuthApi
import pk.raahi.core.network.DefaultRaahiApi
import pk.raahi.core.network.DeviceAuthenticator
import pk.raahi.core.network.HttpClientFactory
import pk.raahi.core.network.RaahiApi

/**
 * Manual dependency injection: one object that builds the graph, lazily, once. Small apps do not need a DI framework,
 * and this keeps the wiring (and every secure default: HTTPS only, optional pinning, no cleartext in release) in one
 * readable place. Tests build the same pieces with fakes.
 */
class AppContainer(private val context: Context) {
    val clock: TimeSource = TimeSource.System

    private val ioScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    val settings: SettingsStore by lazy {
        DataStoreSettingsStore(PreferenceDataStoreFactory.create(scope = ioScope) { context.preferencesDataStoreFile("settings") })
    }

    val database: RaahiDatabase by lazy { RaahiDatabase.create(context) }

    private val httpClient by lazy {
        HttpClientFactory.create(
            allowedCleartextHosts = if (BuildConfig.DEBUG) setOf("10.0.2.2", "localhost") else emptySet(),
            pins = CertPins.parse(BuildConfig.CERT_PINS),
        )
    }

    private val transport by lazy {
        ApiTransport(BuildConfig.API_BASE_URL.toHttpUrl(), httpClient, "RAAHI-Android/${BuildConfig.VERSION_NAME} (Android ${Build.VERSION.SDK_INT})")
    }

    private val authenticator by lazy { DeviceAuthenticator(DefaultAuthApi(transport), { settings.installId() }, { clock.now() }) }

    val api: RaahiApi by lazy { DefaultRaahiApi(transport, authenticator) }

    val syncEngine: SyncEngine by lazy {
        SyncEngine(
            api,
            RoomOpportunityStore(database.opportunities()),
            RoomSyncStateStore(database.syncState()),
            clock,
            SemVer.parse(BuildConfig.VERSION_NAME) ?: SemVer(1, 0, 0),
        )
    }

    val opportunities: OpportunityRepository by lazy {
        DefaultOpportunityRepository(database.opportunities(), database.saved(), database.syncState(), syncEngine, clock)
    }

    val documents: DocumentSource by lazy { DocumentRepository(api, database.documents(), clock) }

    /** The language content is requested in: the app's own choice, else the phone's (Urdu or English). */
    val contentLanguage: Flow<String> by lazy {
        settings.settings.map { it.language }.distinctUntilChanged().map { language ->
            when (language) {
                AppLanguage.URDU -> "ur"
                AppLanguage.ENGLISH -> "en"
                AppLanguage.SYSTEM -> systemContentLanguage()
            }
        }
    }

    val scheduler: WorkScheduler by lazy { WorkScheduler(context) }

    fun startBackgroundWork() {
        scheduler.scheduleDailyReminders()
        ioScope.launchSettingsWatcher()
    }

    private fun CoroutineScope.launchSettingsWatcher() {
        launch { settings.settings.map { it.dataSaver }.distinctUntilChanged().collect { scheduler.schedulePeriodicSync(unmeteredOnly = it) } }
    }
}
