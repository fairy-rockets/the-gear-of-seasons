package net.hexe.the_gear_of_seasons.omote.controller

import io.vertx.core.CompositeFuture
import io.vertx.ext.web.RoutingContext
import io.vertx.kotlin.coroutines.await
import net.hexe.the_gear_of_seasons.shelf.Cache

class EntityController {
  private suspend fun serve(ctx: RoutingContext, type: Cache.Type) {
    val id = ctx.pathParam("id")
    val resp = ctx.response()
    CompositeFuture.all(listOf(resp.sendFile(""))).await()
  }
  suspend fun serveFull(ctx: RoutingContext) {
    serve(ctx, Cache.Type.Full)
  }
  suspend fun serveIcon(ctx: RoutingContext) {
    serve(ctx, Cache.Type.Icon)
  }
  suspend fun serveMedium(ctx: RoutingContext) {
    serve(ctx, Cache.Type.Medium)
  }

}
