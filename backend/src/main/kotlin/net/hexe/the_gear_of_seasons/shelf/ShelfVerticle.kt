package net.hexe.the_gear_of_seasons.shelf

import io.vertx.core.eventbus.Message
import io.vertx.core.eventbus.MessageConsumer
import io.vertx.kotlin.coroutines.CoroutineVerticle
import io.vertx.kotlin.coroutines.await
import net.hexe.the_gear_of_seasons.vertx.IdentityCodec

class ShelfVerticle : CoroutineVerticle() {
  data class EntityFetchRequest(val id: String)
  data class EntityFetchResponse(val entity: Entity)
  data class EntityListRequest(val year: Int?)
  data class EntityListResponse(val entities: List<Entity>)
  data class MomentFetchRequest(val id: String)
  data class MomentFetchResponse(val moment: Moment)
  data class MomentListRequest(val year: Int?)
  data class MomentListResponse(val moments: List<Moment>)
  private lateinit var entityFetchReqConsumer: MessageConsumer<EntityFetchRequest>
  private lateinit var entityListReqConsumer: MessageConsumer<EntityListRequest>
  private lateinit var momentFetchReqConsumer: MessageConsumer<MomentFetchRequest>
  private lateinit var momentListReqConsumer: MessageConsumer<MomentListRequest>
  private lateinit var shelf: Shelf
  override suspend fun start() {
    val path = config.getJsonObject("shelf")?.getString("path") ?: "_shelf"
    shelf = Shelf(vertx, path)
    shelf.init()
    val bus = vertx.eventBus()

    bus.registerDefaultCodec(EntityFetchResponse::class.java, IdentityCodec(EntityFetchResponse::class.java))
    bus.registerDefaultCodec(EntityFetchRequest::class.java, IdentityCodec(EntityFetchRequest::class.java))
    bus.registerDefaultCodec(EntityListResponse::class.java, IdentityCodec(EntityListResponse::class.java))
    bus.registerDefaultCodec(EntityListRequest::class.java, IdentityCodec(EntityListRequest::class.java))

    bus.registerDefaultCodec(MomentFetchResponse::class.java, IdentityCodec(MomentFetchResponse::class.java))
    bus.registerDefaultCodec(MomentFetchRequest::class.java, IdentityCodec(MomentFetchRequest::class.java))
    bus.registerDefaultCodec(MomentListResponse::class.java, IdentityCodec(MomentListResponse::class.java))
    bus.registerDefaultCodec(MomentListRequest::class.java, IdentityCodec(MomentListRequest::class.java))

    entityFetchReqConsumer = bus.consumer("shelf.entity.request.fetch")
    entityListReqConsumer = bus.consumer("shelf.entity.request.list")
    entityFetchReqConsumer.handler(this::entityFetchRequest)
    entityListReqConsumer.handler(this::entityListRequest)

    momentFetchReqConsumer = bus.consumer("shelf.moment.request.fetch")
    momentListReqConsumer = bus.consumer("shelf.moment.request.list")
    momentFetchReqConsumer.handler(this::momentFetchRequest)
    momentListReqConsumer.handler(this::momentListRequest)
  }
  override suspend fun stop() {
    entityFetchReqConsumer.unregister().await()
    entityListReqConsumer.unregister().await()
  }
  private fun entityListRequest(msg: Message<EntityListRequest>) {
    val year = msg.body().year
    val entities = if(year!=null) {
      shelf.entities.values.filter { it -> it.localTime().year == year }
    } else {
      shelf.entities.values.toList()
    }
    msg.reply(EntityListResponse(entities))
  }
  private fun entityFetchRequest(msg: Message<EntityFetchRequest>) {
    val req = msg.body()
    if(!shelf.entities.containsKey(req.id)){
      msg.reply(null)
      return
    }
    when (val entity = shelf.entities[req.id]) {
      is Image -> {
        val image: Image = entity
        msg.reply(EntityFetchResponse(image))
      }
      is Video -> {
        val video: Video = entity
        msg.reply(EntityFetchResponse(video))
      }
      is Audio -> {
        val audio: Audio = entity
        msg.reply(EntityFetchResponse(audio))
      }
    }
  }

  private fun momentListRequest(msg: Message<MomentListRequest>) {
    val year = msg.body().year
    val moments = if(year!=null) {
      shelf.moments.values.filter { it -> it.localTime().year == year }
    } else {
      shelf.moments.values.toList()
    }
    msg.reply(MomentListResponse(moments))
  }
  private fun momentFetchRequest(msg: Message<MomentFetchRequest>) {
    val req = msg.body()
    if (!shelf.moments.containsKey(req.id)) {
      msg.reply(null)
      return
    }
    val moment = shelf.moments[req.id]
    msg.reply(MomentFetchResponse(moment!!))
  }
}
