package pk.raahi.app

import androidx.activity.compose.LocalActivity
import androidx.annotation.StringRes
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import java.time.Instant
import pk.raahi.core.data.Settings
import pk.raahi.core.designsystem.RaahiTheme
import pk.raahi.core.model.PakistanTime
import pk.raahi.feature.opportunities.DetailRoute
import pk.raahi.feature.opportunities.DetailViewModel
import pk.raahi.feature.opportunities.OpportunitiesRoute
import pk.raahi.feature.opportunities.OpportunitiesViewModel
import pk.raahi.feature.opportunities.SavedRoute
import pk.raahi.feature.opportunities.SavedViewModel
import pk.raahi.feature.planner.GuideDetailRoute
import pk.raahi.feature.planner.GuideDetailViewModel
import pk.raahi.feature.planner.LearnRoute
import pk.raahi.feature.planner.LearnViewModel
import pk.raahi.feature.tools.AgeCalculatorScreen
import pk.raahi.feature.tools.ScamCheckRoute
import pk.raahi.feature.tools.ScamCheckViewModel
import pk.raahi.feature.tools.ToolsHomeScreen

/**
 * The root of the UI. It applies the person's language choice (resources and layout direction) and the theme, then draws
 * the navigation scaffold. Everything below depends only on the container's interfaces.
 */
@Composable
fun RaahiApp(container: AppContainer, openOpportunityId: String?, onOpenHandled: () -> Unit) {
    val settings by container.settings.settings.collectAsStateWithLifecycle(initialValue = Settings())
    val base = LocalContext.current
    val localized = remember(base, settings.language) { base.withLanguage(settings.language.tag) }
    val configuration = localized.resources.configuration
    CompositionLocalProvider(
        LocalContext provides localized,
        LocalConfiguration provides configuration,
        LocalLayoutDirection provides layoutDirectionFor(configuration.locales[0]),
    ) {
        RaahiTheme { RaahiScaffold(container, openOpportunityId, onOpenHandled) }
    }
}

private enum class TopLevel(val destination: Any, val icon: ImageVector, @StringRes val label: Int) {
    Home(HomeDestination, Icons.Filled.Home, R.string.nav_home),
    Plan(PlanDestination, Icons.Filled.DateRange, R.string.nav_plan),
    Tools(ToolsDestination, Icons.Filled.Build, R.string.nav_tools),
    Saved(SavedDestination, Icons.Filled.Favorite, R.string.nav_saved),
    Settings(SettingsDestination, Icons.Filled.Settings, R.string.nav_settings),
}

@Composable
private fun RaahiScaffold(container: AppContainer, openOpportunityId: String?, onOpenHandled: () -> Unit) {
    val navController = rememberNavController()
    val snackbar = remember { SnackbarHostState() }
    val backStack by navController.currentBackStackEntryAsState()
    val current = backStack?.destination
    val topLevel = TopLevel.entries.firstOrNull { current?.hasRoute(it.destination::class) == true }
    val context = LocalContext.current
    val activity = LocalActivity.current

    // A tap on a deadline notification opens that listing once.
    LaunchedEffect(openOpportunityId) {
        if (openOpportunityId != null) {
            navController.navigate(DetailDestination(openOpportunityId))
            onOpenHandled()
        }
    }

    val open: (String) -> Unit = { url -> openUrl(activity ?: context, url) }
    val share: (String) -> Unit = { text -> shareText(activity ?: context, text) }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            if (topLevel != null) {
                NavigationBar {
                    TopLevel.entries.forEach { item ->
                        NavigationBarItem(
                            selected = item == topLevel,
                            onClick = {
                                navController.navigate(item.destination) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(item.icon, contentDescription = null) },
                            label = { Text(stringResource(item.label)) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(navController, startDestination = HomeDestination, modifier = Modifier.padding(padding)) {
            composable<HomeDestination> {
                val viewModel: OpportunitiesViewModel = viewModel(factory = remember(container) { OpportunitiesViewModel.Factory(container.opportunities, container.settings, container.clock) })
                OpportunitiesRoute(viewModel, snackbar, onOpen = { navController.navigate(DetailDestination(it)) })
            }
            composable<PlanDestination> {
                val viewModel: LearnViewModel = viewModel(factory = remember(container) { LearnViewModel.Factory(container.documents, container.contentLanguage) })
                LearnRoute(viewModel, onOpenGuide = { navController.navigate(GuideDestination(it)) }, onOpenLink = open)
            }
            composable<ToolsDestination> {
                ToolsHomeScreen(onScamCheck = { navController.navigate(ScamDestination) }, onAgeCalculator = { navController.navigate(AgeDestination) })
            }
            composable<SavedDestination> {
                val viewModel: SavedViewModel = viewModel(factory = remember(container) { SavedViewModel.Factory(container.opportunities) })
                SavedRoute(viewModel, onOpen = { navController.navigate(DetailDestination(it)) })
            }
            composable<SettingsDestination> {
                val viewModel: SettingsViewModel = viewModel(factory = remember(container) { SettingsViewModel.Factory(container.settings, container.opportunities) })
                SettingsRoute(viewModel, onOpenLink = open)
            }
            composable<DetailDestination> { entry ->
                val args = entry.toRoute<DetailDestination>()
                val viewModel: DetailViewModel = viewModel(key = "detail-${args.id}", factory = remember(args.id) { DetailViewModel.Factory(args.id, container.opportunities, container.settings) })
                DetailRoute(viewModel, onBack = { navController.popBackStack() }, onOpenLink = open, onShare = share)
            }
            composable<GuideDestination> { entry ->
                val args = entry.toRoute<GuideDestination>()
                val viewModel: GuideDetailViewModel = viewModel(key = "guide-${args.id}", factory = remember(args.id) { GuideDetailViewModel.Factory(args.id, container.documents, container.contentLanguage) })
                GuideDetailRoute(viewModel, onBack = { navController.popBackStack() }, onOpenLink = open)
            }
            composable<ScamDestination> {
                val viewModel: ScamCheckViewModel = viewModel(factory = remember(container) { ScamCheckViewModel.Factory(container.api) })
                ScamCheckRoute(viewModel, onBack = { navController.popBackStack() }, onOpenLink = open)
            }
            composable<AgeDestination> {
                AgeCalculatorScreen(today = PakistanTime.today(Instant.now()), onBack = { navController.popBackStack() })
            }
        }
    }
}
