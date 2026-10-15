package pk.raahi.core.designsystem

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(sdk = [35])
class SkeletonTest {
    @get:Rule
    val rule = createComposeRule()

    @Test
    fun rendersLabel() {
        rule.setContent { SkeletonLabel("hello raahi") }
        rule.onNodeWithText("hello raahi").assertIsDisplayed()
    }
}
