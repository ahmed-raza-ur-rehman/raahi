plugins {
    alias(libs.plugins.kotlin.jvm)
}

// Shared test support: the golden contract fixtures captured from the real server (../contract), exposed as resources
// under /v1/..., so every module's tests parse exactly what the API produces. Test-only; never shipped in the app.
sourceSets {
    main {
        resources.srcDir(rootProject.projectDir.parentFile.resolve("contract"))
    }
}
