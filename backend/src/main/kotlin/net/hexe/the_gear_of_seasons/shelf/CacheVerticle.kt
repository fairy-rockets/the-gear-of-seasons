package net.hexe.the_gear_of_seasons.shelf

import io.vertx.core.eventbus.Message
import io.vertx.core.eventbus.MessageConsumer
import io.vertx.core.impl.logging.Logger
import io.vertx.core.impl.logging.LoggerFactory
import io.vertx.kotlin.coroutines.CoroutineVerticle
import net.hexe.the_gear_of_seasons.vertx.IdentityCodec
import java.nio.file.Path

class CacheVerticle : CoroutineVerticle() {
  val log: Logger = LoggerFactory.getLogger("CacheVerticle")
  data class FetchRequest(val entity: Entity, val type: Cache.Type)
  data class FetchResponse(val path: String)
  lateinit var path: String
  lateinit var cache: Cache
  private lateinit var fetchReqConsumer: MessageConsumer<FetchRequest>
  override suspend fun start() {
    path = config.getJsonObject("cache")?.getString("path") ?: "_cache"
    cache = Cache(vertx, path)
    cache.prepare()
    val bus = vertx.eventBus()
    bus.registerDefaultCodec(FetchResponse::class.java, IdentityCodec(FetchResponse::class.java))
    bus.registerDefaultCodec(FetchRequest::class.java, IdentityCodec(FetchRequest::class.java))
    fetchReqConsumer = bus.consumer("cache.request.fetch")
    fetchReqConsumer.handler(this::fetchRequest)
  }
  override suspend fun stop() {
    fetchReqConsumer.unregister()
  }
  private fun fetchRequest(msg: Message<FetchRequest>) {
    val req = msg.body()
    when(req.type) {
      Cache.Type.Full -> {
        msg.reply(FetchResponse(req.entity.dataPath()))
      }
      Cache.Type.Medium -> {
        msg.reply(FetchResponse(Path.of(path, "medium", req.entity.id.take(2), "${req.entity.id}.jpg").toAbsolutePath().toString()))
      }
      Cache.Type.Icon -> {
        msg.reply(FetchResponse(Path.of(path, "icon", req.entity.id.take(2), "${req.entity.id}.jpg").toAbsolutePath().toString()))
      }
    }
  }
}
