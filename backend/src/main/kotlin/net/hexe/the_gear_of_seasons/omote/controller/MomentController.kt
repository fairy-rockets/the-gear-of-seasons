package net.hexe.the_gear_of_seasons.omote.controller

import io.vertx.ext.web.RoutingContext
import io.vertx.kotlin.coroutines.await

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
    resp.end(id).await()
  }

}
