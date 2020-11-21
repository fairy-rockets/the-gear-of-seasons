package net.hexe.the_gear_of_seasons

import io.vertx.core.DeploymentOptions
import io.vertx.core.Vertx
import io.vertx.core.VertxOptions
import io.vertx.kotlin.coroutines.await

suspend fun main(args: Array<String>) {
  val vertx = Vertx.vertx()
  val deploymentOptions = DeploymentOptions()
    .setInstances(3)
  vertx.deployVerticle(MainVerticle::class.java, deploymentOptions).await()
}
