plugins {
    alias(libs.plugins.kotlin.jvm)
}

// Pure Kotlin: no Android, no I/O. Everything here is unit-tested on the JVM and, where the server has the same
// logic (age arithmetic, deadline status), against the server's own test vectors.
dependencies {
    testImplementation(project(":core:testing"))
    testImplementation(libs.kotlinx.serialization.json)
    testImplementation(libs.junit)
    testImplementation(libs.kotlin.test.junit)
}
