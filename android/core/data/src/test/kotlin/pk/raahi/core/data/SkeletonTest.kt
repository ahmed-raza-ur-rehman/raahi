package pk.raahi.core.data

import app.cash.turbine.test
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SkeletonTest {
    @Test
    fun repositoryPings() = assertTrue(SkeletonRepository().ping().ok)

    @Test
    fun turbineWorks() = runTest {
        flowOf(1, 2).test {
            assertEquals(1, awaitItem())
            assertEquals(2, awaitItem())
            awaitComplete()
        }
    }
}
