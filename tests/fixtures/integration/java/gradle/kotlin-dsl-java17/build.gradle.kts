plugins {
    java
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}

tasks.withType<JavaCompile>().configureEach {
    options.isDebug = true
    options.debugOptions.debugLevel = "source,lines,vars"
}
