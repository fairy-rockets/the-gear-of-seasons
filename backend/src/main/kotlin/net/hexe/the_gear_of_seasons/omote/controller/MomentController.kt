package net.hexe.the_gear_of_seasons.omote.controller

import io.vertx.ext.web.RoutingContext
import io.vertx.kotlin.coroutines.await
import net.hexe.the_gear_of_seasons.shelf.ShelfVerticle

class MomentController {
  suspend fun search(ctx: RoutingContext) {
    val vertx = ctx.vertx()
    val bus = vertx.eventBus()
    val resp = ctx.response()
    resp.end("search").await()
  }
  suspend fun serve(ctx: RoutingContext) {
    val vertx = ctx.vertx()
    val id = ctx.pathParam("date")
    val bus = vertx.eventBus()
    val resp = ctx.response()

    val fetchResp = bus
      .request<ShelfVerticle.MomentFetchResponse>("shelf.moment.request.fetch", ShelfVerticle.MomentFetchRequest(id))
      .await()
      .body()
    if(fetchResp == null) {
      resp.statusCode = 404
      resp.end("File not found").await()
      return
    }
    val moment = fetchResp.moment
    resp.end(moment.text).await()
  }

}
