plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// Release metadata and the server address come from Gradle properties so CI can set them without editing files:
//   -PraahiVersionName=1.2.0 -PraahiVersionCode=42 -PraahiApiBaseUrl=https://example.org/
val versionNameProp = (findProperty("raahiVersionName") as String?) ?: "1.0.0"
val versionCodeProp = (findProperty("raahiVersionCode") as String?)?.toIntOrNull() ?: 1
val apiBaseUrl = (findProperty("raahiApiBaseUrl") as String?) ?: "https://raahi-phi.vercel.app/"
// Optional certificate pins: "host=sha256/AAAA|sha256/BBBB;host2=sha256/CCCC". Empty by default (see docs/mobile/security.md).
val certPins = (findProperty("raahiCertPins") as String?).orEmpty()

android {
    namespace = "pk.raahi.app"

    defaultConfig {
        applicationId = "pk.raahi.app"
        versionCode = versionCodeProp
        versionName = versionNameProp
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
        buildConfigField("String", "CERT_PINS", "\"$certPins\"")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    // The signing key never lives in the repository: CI provides it through the environment (docs/mobile/release.md).
    signingConfigs {
        val keystore = System.getenv("RAAHI_KEYSTORE_PATH")
        if (!keystore.isNullOrBlank()) {
            create("release") {
                storeFile = file(keystore)
                storePassword = System.getenv("RAAHI_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("RAAHI_KEY_ALIAS")
                keyPassword = System.getenv("RAAHI_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release")
        }
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    lint {
        abortOnError = true
        checkReleaseBuilds = true
        // Version-freshness checks need the network and would make the build non-reproducible; Dependabot owns upgrades.
        disable += setOf("GradleDependency", "NewerVersionAvailable", "AndroidGradlePluginVersion")
    }
}

dependencies {
    implementation(project(":core:designsystem"))
    implementation(project(":core:data"))
    implementation(project(":feature:opportunities"))
    implementation(project(":feature:planner"))
    implementation(project(":feature:tools"))
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.work.runtime.ktx)
    implementation(libs.androidx.browser)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.kotlinx.serialization.json)

    testImplementation(libs.junit)
    testImplementation(libs.kotlin.test.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)
}
