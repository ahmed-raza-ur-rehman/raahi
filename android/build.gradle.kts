import com.android.build.api.dsl.ApplicationExtension
import com.android.build.api.dsl.LibraryExtension
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

// Top-level build: plugin versions are declared once (here, from the version catalog) and applied per module.
// Shared Android settings live in this file so every module is configured identically (one place to change
// compileSdk / minSdk / Java level / test options).
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.ksp) apply false
    alias(libs.plugins.androidx.room) apply false
}

val javaLevel = JavaVersion.VERSION_17

subprojects {
    plugins.withId("com.android.library") {
        extensions.configure<LibraryExtension> {
            compileSdk = 37
            defaultConfig { minSdk = 26 }
            compileOptions {
                sourceCompatibility = javaLevel
                targetCompatibility = javaLevel
            }
            testOptions {
                unitTests {
                    isIncludeAndroidResources = true
                    isReturnDefaultValues = true
                }
            }
        }
    }
    plugins.withId("com.android.application") {
        extensions.configure<ApplicationExtension> {
            compileSdk = 37
            defaultConfig {
                minSdk = 26
                targetSdk = 36
            }
            compileOptions {
                sourceCompatibility = javaLevel
                targetCompatibility = javaLevel
            }
            testOptions {
                unitTests {
                    isIncludeAndroidResources = true
                    isReturnDefaultValues = true
                }
            }
        }
    }
    tasks.withType<KotlinCompile>().configureEach {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_17)
            // A warning is a bug waiting for a release: the build fails on any compiler warning.
            // -Praahi.werror=false (used only by the temporary CI dev loop) lists the warnings instead of failing on them.
            allWarningsAsErrors.set(providers.gradleProperty("raahi.werror").map { it.toBoolean() }.orElse(true))
        }
    }
}
