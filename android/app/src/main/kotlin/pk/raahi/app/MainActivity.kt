package pk.raahi.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import pk.raahi.app.work.Notifications

class MainActivity : ComponentActivity() {
    /** A listing to open, set when the person taps a deadline notification. */
    private var pendingOpportunityId by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        pendingOpportunityId = intent.opportunityId()
        val container = (application as RaahiApplication).container
        setContent { RaahiApp(container, pendingOpportunityId) { pendingOpportunityId = null } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        pendingOpportunityId = intent.opportunityId()
    }

    /** Only well-formed listing ids are accepted from an intent: it is an input from outside the app. */
    private fun Intent.opportunityId(): String? =
        getStringExtra(Notifications.EXTRA_OPPORTUNITY_ID)?.takeIf { Regex("^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$").matches(it) }
}
