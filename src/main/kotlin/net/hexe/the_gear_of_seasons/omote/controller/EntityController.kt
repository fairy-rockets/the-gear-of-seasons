package net.hexe.the_gear_of_seasons.omote.controller

import io.vertx.core.CompositeFuture
import io.vertx.ext.web.RoutingContext
import io.vertx.kotlin.coroutines.await
import net.hexe.the_gear_of_seasons.shelf.ShelfVerticle.EntityType
import net.hexe.the_gear_of_seasons.shelf.ShelfVerticle.EntityType.*

class EntityController {
  private suspend fun serve(ctx: RoutingContext, type: EntityType) {
    val id = ctx.pathParam("id")
    val resp = ctx.response()
    CompositeFuture.all(listOf(resp.sendFile(""))).await()
  }
  suspend fun serveFull(ctx: RoutingContext) {
    serve(ctx, Full)
  }
  suspend fun serveIcon(ctx: RoutingContext) {
    serve(ctx, Icon)
  }
  suspend fun serveMedium(ctx: RoutingContext) {
    serve(ctx, Medium)
  }

}
