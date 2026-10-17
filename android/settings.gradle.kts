pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
    }
}

rootProject.name = "raahi-android"

include(
    ":app",
    ":core:model",
    ":core:network",
    ":core:database",
    ":core:data",
    ":core:designsystem",
    ":core:testing",
    ":feature:opportunities",
    ":feature:planner",
    ":feature:tools",
)
