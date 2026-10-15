package pk.raahi.app

import android.app.Application
import pk.raahi.app.work.Notifications

class RaahiApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        Notifications.createChannels(this)
        container.startBackgroundWork()
    }
}
