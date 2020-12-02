package net.hexe.the_gear_of_seasons.shelf

import io.vertx.core.eventbus.Message
import io.vertx.core.eventbus.MessageConsumer
import io.vertx.kotlin.coroutines.CoroutineVerticle
import io.vertx.kotlin.coroutines.await
import net.hexe.the_gear_of_seasons.vertx.util.IdentityCodec

class ShelfVerticle : CoroutineVerticle() {
  data class FetchRequest(val id: String)
  data class FetchResponse(val entity: Entity)
  data class ListRequest(val year: Int?)
  data class ListResponse(val entities: List<Entity>)
  private lateinit var fetchReqConsumer: MessageConsumer<FetchRequest>
  private lateinit var listReqConsumer: MessageConsumer<ListRequest>
  private lateinit var shelf: Shelf
  override suspend fun start() {
    val path = config.getJsonObject("shelf")?.getString("path") ?: "_shelf"
    shelf = Shelf(vertx, path)
    shelf.init()
    val bus = vertx.eventBus()
    bus.registerDefaultCodec(FetchResponse::class.java, IdentityCodec(FetchResponse::class.java))
    bus.registerDefaultCodec(FetchRequest::class.java, IdentityCodec(FetchRequest::class.java))
    bus.registerDefaultCodec(ListResponse::class.java, IdentityCodec(ListResponse::class.java))
    bus.registerDefaultCodec(ListRequest::class.java, IdentityCodec(ListRequest::class.java))
    fetchReqConsumer = bus.consumer("shelf.request.fetch")
    listReqConsumer = bus.consumer("shelf.request.list")
    fetchReqConsumer.handler(this::fetchRequest)
    listReqConsumer.handler(this::listRequest)
  }
  override suspend fun stop() {
    fetchReqConsumer.unregister().await()
    listReqConsumer.unregister().await()
  }
  private fun listRequest(msg: Message<ListRequest>) {
    val year = msg.body().year
    val entities = mutableListOf<Entity>()
    for(entity in shelf.entities.values) {
      if(year == null || entity.localTime().year == year) {
        entities.add(entity)
      }
    }
    msg.reply(ListResponse(entities))
  }
  private fun fetchRequest(msg: Message<FetchRequest>) {
    val req = msg.body()
    if(!shelf.entities.containsKey(req.id)){
      msg.reply(null)
      return
    }
    when (val entity = shelf.entities[req.id]) {
      is Image -> {
        val image: Image = entity
        msg.reply(FetchResponse(image))
      }
      is Video -> {
        val video: Video = entity
        msg.reply(FetchResponse(video))
      }
      is Audio -> {
        val audio: Audio = entity
        msg.reply(FetchResponse(audio))
      }
    }
  }
}
