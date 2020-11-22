import com.github.jengelman.gradle.plugins.shadow.tasks.ShadowJar
import org.gradle.api.tasks.testing.logging.TestLogEvent.*
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
  kotlin ("jvm") version "1.4.10"
  application
  id("com.github.johnrengelman.shadow") version "5.2.0"
}

group = "net.hexe"
version = "1.0.0-SNAPSHOT"

repositories {
  mavenCentral()
  jcenter()
  maven("https://jitpack.io")
}

val kotlinVersion = "1.4.10"
val vertxVersion = "4.0.0.CR1"
val junitJupiterVersion = "5.6.0"
val slf4jVersion = "1.7.30"

val mainVerticleName = "net.hexe.the_gear_of_seasons.MainVerticle"
val watchForChange = "src/**/*"
val doOnChange = "./gradlew classes"
val launcherClassName = "io.vertx.core.Launcher"

application {
  mainClassName = "net.hexe.the_gear_of_seasons.MainKt"
}

dependencies {
  compileOnly("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")

  implementation("org.slf4j:slf4j-api:$slf4jVersion")
  implementation("org.slf4j:slf4j-simple:$slf4jVersion")
  implementation("io.vertx:vertx-config:$vertxVersion")
  implementation("io.vertx:vertx-config-yaml:$vertxVersion")
  implementation("io.vertx:vertx-web-templ-handlebars:$vertxVersion")
  implementation("io.vertx:vertx-web:$vertxVersion")
  implementation("io.vertx:vertx-lang-kotlin-coroutines:$vertxVersion")
  implementation("io.vertx:vertx-json-schema:$vertxVersion")
  implementation("io.vertx:vertx-lang-kotlin:$vertxVersion")
  implementation(kotlin("stdlib-jdk8"))
  implementation("org.yaml:snakeyaml:1.26")
  implementation("com.github.beosign:snakeyaml-anno:1.1.1")

  testImplementation("io.vertx:vertx-junit5:$vertxVersion")
  testImplementation("org.junit.jupiter:junit-jupiter:$junitJupiterVersion")
}

// https://youtrack.jetbrains.com/issue/KT-43380#focus=Comments-27-4516152.0-0
tasks.withType<KotlinCompile>().all {
  kotlinOptions.jvmTarget = "11"
}

tasks.withType<ShadowJar> {
  archiveClassifier.set("")
  archiveVersion.set("")
  manifest {
    attributes(mapOf("Main-Verticle" to mainVerticleName))
  }
  mergeServiceFiles {
    include("META-INF/services/io.vertx.core.spi.VerticleFactory")
  }
}

tasks.withType<Test> {
  useJUnitPlatform()
  testLogging {
    events = setOf(PASSED, SKIPPED, FAILED)
  }
}

tasks.withType<JavaExec> {
  args = listOf("run") //listOf("run", mainVerticleName, "--redeploy=$watchForChange", "--launcher-class=$launcherClassName", "--on-redeploy=$doOnChange")
  minHeapSize = "64m"
  maxHeapSize = "128m"
}
