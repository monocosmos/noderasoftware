plugins {
    alias(libs.plugins.android.application)
}

if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

android {
    namespace = "com.example.nodera"
    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        minSdk = 23
        targetSdk = 36
        // versionName kullaniciya gorunen sade surumdur. versionCode Android'in
        // yukleme siralamasi icin monoton kalir; gizli urun build'i Kotlin
        // tarafinda HotelOpsAppVersion.BUILD ile tutulur.
        versionCode = 2026052901
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    flavorDimensions += "distribution"
    productFlavors {
        create("direct") {
            dimension = "distribution"
            applicationId = "com.example.nodera"
            buildConfigField("String", "HOTELOPS_DISTRIBUTION", "\"direct\"")
        }
        create("play") {
            dimension = "distribution"
            applicationId = "com.noderasoftware.hotelops"
            buildConfigField("String", "HOTELOPS_DISTRIBUTION", "\"play\"")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

dependencies {
    implementation(platform(libs.firebase.bom))
    implementation(libs.androidx.activity)
    implementation(libs.androidx.core.ktx)
    implementation(libs.firebase.messaging)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
}
