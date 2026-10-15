package pk.raahi.app

import android.content.Context
import android.content.res.Configuration
import android.text.TextUtils
import android.view.View
import androidx.compose.ui.unit.LayoutDirection
import java.util.Locale

/**
 * The app's own language choice (system / English / Urdu) is applied by wrapping the context the UI reads resources from,
 * which also flips the layout direction for Urdu. It avoids a dependency on AppCompat just to switch languages.
 */
fun Context.withLanguage(tag: String?): Context {
    if (tag == null) return this
    val locale = Locale.forLanguageTag(tag)
    val configuration = Configuration(resources.configuration)
    configuration.setLocale(locale)
    configuration.setLayoutDirection(locale)
    return createConfigurationContext(configuration)
}

fun layoutDirectionFor(locale: Locale): LayoutDirection =
    if (TextUtils.getLayoutDirectionFromLocale(locale) == View.LAYOUT_DIRECTION_RTL) LayoutDirection.Rtl else LayoutDirection.Ltr

/** The language sent to the API for content: Urdu when the phone is in Urdu, otherwise English. */
fun systemContentLanguage(): String = if (Locale.getDefault().language == "ur") "ur" else "en"
