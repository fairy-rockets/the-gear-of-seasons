package net.hexe.the_gear_of_seasons

import io.vertx.core.DeploymentOptions
import io.vertx.core.Vertx
import io.vertx.kotlin.coroutines.await
import io.vertx.config.ConfigStoreOptions
import io.vertx.config.ConfigRetrieverOptions
import io.vertx.config.ConfigRetriever
import io.vertx.core.impl.logging.LoggerFactory
import io.vertx.core.json.JsonObject
import kotlinx.coroutines.*

fun main(args: Array<String>) {
  val log = LoggerFactory.getLogger("main")
  val vertx = Vertx.vertx()
  var err: Throwable? = null
  runBlocking {
    try {
      log.info("Launched")
      start(vertx, args)
    } catch (th: Throwable) {
      vertx.close().await()
      log.error(th)
      err = th
    } finally {
      //vertx.close().await()
    }
  }
  if(err != null) {
    throw err!!
  }
  log.info("All done!")
}

suspend fun start(vertx: Vertx, args: Array<String>) {
  val store = ConfigStoreOptions()
    .setType("file")
    .setFormat("yaml")
    .setConfig(
      JsonObject()
        .put("path", "config/main.yaml")
    )
  val retriever = ConfigRetriever.create(vertx, ConfigRetrieverOptions().addStore(store))
  val config = retriever.config.await()
  vertx.deployVerticle(
    net.hexe.the_gear_of_seasons.shelf.ShelfVerticle::class.java,
    DeploymentOptions().setInstances(1).setWorker(true).setWorkerPoolName("ShelfWorker").setConfig(config)
  ).await()
  vertx.deployVerticle(
    net.hexe.the_gear_of_seasons.shelf.CacheVerticle::class.java,
    DeploymentOptions().setInstances(1).setWorker(true).setWorkerPoolName("CacheWorker").setConfig(config)
  ).await()
  vertx.deployVerticle(
    net.hexe.the_gear_of_seasons.omote.OmoteVerticle::class.java,
    DeploymentOptions().setInstances(3).setWorker(false).setConfig(config)
  ).await()
}
