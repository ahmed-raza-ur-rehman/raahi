package pk.raahi.core.data

import java.time.Instant
import java.time.LocalDate
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flow
import pk.raahi.core.model.PakistanTime

/** The clock, injectable so tests (and the sync logic) never read the wall clock directly. */
fun interface TimeSource {
    fun now(): Instant

    companion object {
        val System: TimeSource = TimeSource { Instant.now() }
    }
}

/** Emits today's date in Pakistan now and again whenever it changes, so open screens drop yesterday's deadlines at midnight. */
fun TimeSource.todayInPakistan(checkEveryMillis: Long = 60_000): Flow<LocalDate> = flow {
    while (true) {
        emit(PakistanTime.today(now()))
        delay(checkEveryMillis)
    }
}.distinctUntilChanged()
