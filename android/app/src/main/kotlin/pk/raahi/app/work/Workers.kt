package pk.raahi.app.work

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.flow.first
import pk.raahi.app.RaahiApplication
import pk.raahi.app.withLanguage
import pk.raahi.core.data.SyncOutcome
import pk.raahi.core.database.NotificationLogEntity
import pk.raahi.core.model.ReminderPlanner
import pk.raahi.core.model.SavedDeadline
import pk.raahi.core.network.ApiError

private fun Context.container() = (applicationContext as RaahiApplication).container

/** Background synchronisation: the same [pk.raahi.core.data.SyncEngine] the "Update now" button uses. */
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = when (val outcome = applicationContext.container().syncEngine.sync()) {
        is SyncOutcome.Failed -> if (runAttemptCount < MAX_ATTEMPTS && outcome.error.isTransient()) Result.retry() else Result.failure()
        else -> Result.success()
    }

    private fun ApiError.isTransient() = this == ApiError.Offline || this == ApiError.Timeout || this is ApiError.RateLimited || (this is ApiError.Server && status in 500..599)

    private companion object {
        const val MAX_ATTEMPTS = 3
    }
}

/** Once a day: tell the person about saved listings that are about to close (only if they opted in and allowed notifications). */
class ReminderWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val container = applicationContext.container()
        val settings = container.settings.settings.first()
        if (!settings.notificationsEnabled) return Result.success()
        val localized = applicationContext.withLanguage(settings.language.tag)

        val database = container.database
        val now = container.clock.now()
        val sent = database.notificationLog().keys().toSet()
        val saved = database.saved().withDeadlines().mapNotNull { row ->
            val deadline = row.deadline?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: return@mapNotNull null
            SavedDeadline(row.id, row.title, deadline, row.reminderDays.split(',').mapNotNull { it.trim().toIntOrNull() }.toSet())
        }
        for (reminder in ReminderPlanner.due(saved, now, sent)) {
            if (Notifications.show(localized, reminder)) database.notificationLog().insert(NotificationLogEntity(reminder.key, now.toEpochMilli()))
        }
        database.notificationLog().prune(now.minus(Duration.ofDays(120)).toEpochMilli())
        return Result.success()
    }
}

class WorkScheduler(private val context: Context) {
    /** Every six hours, on any connection - or only on unmetered ones when the person chose "data saver". */
    fun schedulePeriodicSync(unmeteredOnly: Boolean) {
        val constraints = Constraints.Builder().setRequiredNetworkType(if (unmeteredOnly) NetworkType.UNMETERED else NetworkType.CONNECTED).build()
        val request = PeriodicWorkRequestBuilder<SyncWorker>(6, TimeUnit.HOURS)
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(SYNC, ExistingPeriodicWorkPolicy.UPDATE, request)
    }

    fun scheduleDailyReminders(now: Instant = Instant.now()) {
        val request = PeriodicWorkRequestBuilder<ReminderWorker>(24, TimeUnit.HOURS)
            .setInitialDelay(ReminderTiming.delayUntilNextNineAm(now).toMillis(), TimeUnit.MILLISECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(REMINDERS, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    companion object {
        const val SYNC = "raahi-sync"
        const val REMINDERS = "raahi-reminders"
    }
}
