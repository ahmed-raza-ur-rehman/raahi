package pk.raahi.core.model

import kotlin.test.Test
import kotlin.test.assertTrue

class SkeletonTest {
    @Test
    fun pingIsOk() = assertTrue(ping().ok)
}
