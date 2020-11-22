package net.hexe.the_gear_of_seasons.shelf

import io.vertx.core.eventbus.Message
import io.vertx.core.eventbus.MessageConsumer
import io.vertx.kotlin.coroutines.CoroutineVerticle
import io.vertx.kotlin.coroutines.await

class ShelfVerticle : CoroutineVerticle() {
  enum class EntityType {
    Full,
    Medium,
    Icon,
  }
  data class FetchRequest(val id: String, val type: EntityType)
  data class FetchResponse(val id: String, val path: String)
  lateinit var entityReqConsumer: MessageConsumer<FetchRequest>
  lateinit var shelf: Shelf
  override suspend fun start() {
    val config = vertx.orCreateContext.config()
    val path = config.getJsonObject("shelf")?.getString("path") ?: "_shelf"
    shelf = Shelf(vertx, path)
    shelf.init()
    entityReqConsumer = vertx.eventBus().consumer<FetchRequest>("entity.request")
    entityReqConsumer.handler(this::entityRequest)
  }
  override suspend fun stop() {
    entityReqConsumer.unregister().await()
  }
  private fun entityRequest(msg: Message<FetchRequest>) {
    val req = msg.body()
    if(!shelf.entities.containsKey(req.id)){
      msg.reply(null)
      return
    }
    when (val entity = shelf.entities[req.id]) {
      is Image -> {
        val image: Image = entity
      }
      is Video -> {
        val video: Video = entity
      }
      is Audio -> {
        val audio: Audio = entity
      }
    }
  }
}
