package pk.raahi.app.work

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import pk.raahi.app.MainActivity
import pk.raahi.app.R
import pk.raahi.core.model.Reminder

object Notifications {
    const val CHANNEL_DEADLINES = "deadlines"
    const val EXTRA_OPPORTUNITY_ID = "pk.raahi.app.OPPORTUNITY_ID"

    fun createChannels(context: Context) {
        val channel = NotificationChannel(CHANNEL_DEADLINES, context.getString(R.string.notif_channel_deadlines), NotificationManager.IMPORTANCE_DEFAULT)
        channel.description = context.getString(R.string.notif_channel_deadlines_description)
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    fun canNotify(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    /** Shows one reminder. Returns false (and shows nothing) when the notification permission has not been granted. */
    @SuppressLint("MissingPermission")
    fun show(context: Context, reminder: Reminder): Boolean {
        if (!canNotify(context)) return false
        val open = Intent(context, MainActivity::class.java)
            .putExtra(EXTRA_OPPORTUNITY_ID, reminder.opportunityId)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pending = PendingIntent.getActivity(context, reminder.key.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val title = if (reminder.daysLeft == 0) context.getString(R.string.notif_title_today) else context.resources.getQuantityString(R.plurals.notif_title_days, reminder.daysLeft, reminder.daysLeft)
        val notification = NotificationCompat.Builder(context, CHANNEL_DEADLINES)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(reminder.title)
            .setStyle(NotificationCompat.BigTextStyle().bigText(reminder.title))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()
        NotificationManagerCompat.from(context).notify(reminder.key.hashCode(), notification)
        return true
    }
}
