package pk.raahi.app

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.net.toUri
import pk.raahi.core.model.UrlPolicy

/** Opens an official page in a Custom Tab (the browser's own sandbox), and only if it passes the link policy. */
fun openUrl(context: Context, url: String) {
    if (!UrlPolicy.isSafeToOpen(url)) return
    val tab = CustomTabsIntent.Builder().setShowTitle(true).build()
    tab.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
        tab.launchUrl(context, url.toUri())
    } catch (_: ActivityNotFoundException) {
        // No browser installed: nothing sensible to do.
    }
}

fun shareText(context: Context, text: String) {
    val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
    context.startActivity(Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}
