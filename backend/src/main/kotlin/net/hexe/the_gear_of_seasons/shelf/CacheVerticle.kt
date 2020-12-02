package net.hexe.the_gear_of_seasons.shelf

import io.vertx.core.impl.logging.Logger
import io.vertx.core.impl.logging.LoggerFactory
import io.vertx.kotlin.coroutines.CoroutineVerticle

class CacheVerticle : CoroutineVerticle() {
  val log: Logger = LoggerFactory.getLogger("CacheVerticle")
  data class FetchRequest(val entity: Entity, val type: Cache.Type)
  data class FetchResponse(val path: String?)
  lateinit var path: String
  lateinit var cache: Cache
  override suspend fun start() {
    path = config.getJsonObject("cache")?.getString("path") ?: "_cache"
    cache = Cache(vertx, path)
    cache.prepare()
  }
  override suspend fun stop() {
  }
}
