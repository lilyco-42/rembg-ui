plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The public source build is intentionally unsigned. A release keystore can be
// injected by CI (or a local operator) through Gradle properties without ever
// committing a password or a private key to the repository.
val releaseStoreFile = providers.gradleProperty("REMBG_RELEASE_STORE_FILE").orNull
    ?: System.getenv("REMBG_RELEASE_STORE_FILE")
val releaseStorePassword = providers.gradleProperty("REMBG_RELEASE_STORE_PASSWORD").orNull
    ?: System.getenv("REMBG_RELEASE_STORE_PASSWORD")
val releaseKeyAlias = providers.gradleProperty("REMBG_RELEASE_KEY_ALIAS").orNull
    ?: System.getenv("REMBG_RELEASE_KEY_ALIAS")
val releaseKeyPassword = providers.gradleProperty("REMBG_RELEASE_KEY_PASSWORD").orNull
    ?: System.getenv("REMBG_RELEASE_KEY_PASSWORD")
val hasReleaseSigning = listOf(
    releaseStoreFile,
    releaseStorePassword,
    releaseKeyAlias,
    releaseKeyPassword,
).all { !it.isNullOrBlank() }
val appVersionName = providers.gradleProperty("REMBG_VERSION_NAME").orNull
    ?: System.getenv("REMBG_VERSION_NAME")
    ?: "0.2.7"
val appVersionCode = providers.gradleProperty("REMBG_VERSION_CODE").orNull?.toIntOrNull()
    ?: System.getenv("REMBG_VERSION_CODE")?.toIntOrNull()
    ?: 3

android {
    namespace = "com.lilyco42.rembgui"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.lilyco42.rembgui"
        minSdk = 29
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersionName
        vectorDrawables.useSupportLibrary = true
    }

    // Keep the download/install size predictable on phones. The universal APK
    // is deliberately disabled; Play uses the AAB split and direct downloads
    // receive one ABI-specific artifact.
    splits {
        abi {
            isEnable = true
            reset()
            include("arm64-v8a", "armeabi-v7a", "x86_64")
            isUniversalApk = false
        }
    }

    bundle {
        abi {
            enableSplit = true
        }
        language {
            enableSplit = false
        }
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("commercialRelease") {
                storeFile = project.file(releaseStoreFile!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            // R8 removes unused Android/support code while proguard-rules.pro
            // keeps ONNX Runtime's reflective/native entry points.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("commercialRelease")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    androidResources {
        noCompress += "onnx"
    }

    packaging {
        jniLibs {
            // Keep native ONNX libraries mmap-friendly and avoid a second copy
            // during install on modern Android versions.
            useLegacyPackaging = false
        }
        resources {
            excludes += setOf("META-INF/NOTICE*", "META-INF/LICENSE*", "META-INF/DEPENDENCIES")
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("com.microsoft.onnxruntime:onnxruntime-android:1.19.2")
    // Small, API-29-compatible Ed25519 verifier for offline ``ol1`` licenses.
    // The private signing key never ships in the application.
    implementation("net.i2p.crypto:eddsa:0.3.0")
    testImplementation("junit:junit:4.13.2")
}
