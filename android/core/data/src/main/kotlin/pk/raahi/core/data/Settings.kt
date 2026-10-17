package pk.raahi.core.data

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import java.util.UUID
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

enum class AppLanguage(val tag: String?) {
    SYSTEM(null),
    ENGLISH("en"),
    URDU("ur"),
    ;

    companion object {
        fun fromName(name: String?): AppLanguage = entries.firstOrNull { it.name == name } ?: SYSTEM
    }
}

/**
 * The person's choices. Notifications are OFF until they opt in (and the Android 13 permission is a separate step);
 * "data saver" limits background sync to unmetered networks.
 */
data class Settings(
    val language: AppLanguage = AppLanguage.SYSTEM,
    val notificationsEnabled: Boolean = false,
    val reminderDays: Set<Int> = setOf(7, 1),
    val dataSaver: Boolean = false,
    val onboardingDone: Boolean = false,
)

interface SettingsStore {
    val settings: Flow<Settings>

    suspend fun update(transform: (Settings) -> Settings)

    /** A random id for this install, created on first use. It identifies the app install to the API, never a person. */
    suspend fun installId(): String
}

class DataStoreSettingsStore(
    private val store: DataStore<Preferences>,
    private val newId: () -> String = { UUID.randomUUID().toString() },
) : SettingsStore {
    private object Keys {
        val language = stringPreferencesKey("language")
        val notifications = booleanPreferencesKey("notifications")
        val reminderDays = stringPreferencesKey("reminder_days")
        val dataSaver = booleanPreferencesKey("data_saver")
        val onboardingDone = booleanPreferencesKey("onboarding_done")
        val installId = stringPreferencesKey("install_id")
    }

    override val settings: Flow<Settings> = store.data.map { prefs ->
        Settings(
            language = AppLanguage.fromName(prefs[Keys.language]),
            notificationsEnabled = prefs[Keys.notifications] ?: false,
            reminderDays = parseDays(prefs[Keys.reminderDays]) ?: Settings().reminderDays,
            dataSaver = prefs[Keys.dataSaver] ?: false,
            onboardingDone = prefs[Keys.onboardingDone] ?: false,
        )
    }

    override suspend fun update(transform: (Settings) -> Settings) {
        store.edit { prefs ->
            val current = Settings(
                language = AppLanguage.fromName(prefs[Keys.language]),
                notificationsEnabled = prefs[Keys.notifications] ?: false,
                reminderDays = parseDays(prefs[Keys.reminderDays]) ?: Settings().reminderDays,
                dataSaver = prefs[Keys.dataSaver] ?: false,
                onboardingDone = prefs[Keys.onboardingDone] ?: false,
            )
            val next = transform(current)
            prefs[Keys.language] = next.language.name
            prefs[Keys.notifications] = next.notificationsEnabled
            prefs[Keys.reminderDays] = next.reminderDays.filter { it in 0..60 }.sorted().joinToString(",")
            prefs[Keys.dataSaver] = next.dataSaver
            prefs[Keys.onboardingDone] = next.onboardingDone
        }
    }

    override suspend fun installId(): String {
        store.edit { prefs -> if (prefs[Keys.installId].isNullOrBlank()) prefs[Keys.installId] = newId() }
        return checkNotNull(store.data.first()[Keys.installId])
    }

    private fun parseDays(text: String?): Set<Int>? =
        text?.split(',')?.mapNotNull { it.trim().toIntOrNull() }?.filter { it in 0..60 }?.toSet()?.takeIf { it.isNotEmpty() }
}
