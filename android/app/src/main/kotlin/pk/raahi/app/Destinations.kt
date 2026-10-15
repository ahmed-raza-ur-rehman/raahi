package pk.raahi.app

import kotlinx.serialization.Serializable

/** Type-safe navigation destinations. Top-level tabs first, then screens that open on top of them. */
@Serializable
object HomeDestination

@Serializable
object PlanDestination

@Serializable
object ToolsDestination

@Serializable
object SavedDestination

@Serializable
object SettingsDestination

@Serializable
data class DetailDestination(val id: String)

@Serializable
data class GuideDestination(val id: String)

@Serializable
object ScamDestination

@Serializable
object AgeDestination
