package net.hexe.the_gear_of_seasons.omote.controller

import io.vertx.core.Vertx
import io.vertx.ext.web.RoutingContext
import io.vertx.kotlin.coroutines.await
import net.hexe.the_gear_of_seasons.shelf.Cache
import net.hexe.the_gear_of_seasons.shelf.CacheVerticle
import net.hexe.the_gear_of_seasons.shelf.ShelfVerticle

class EntityController() {
  private suspend fun serve(ctx: RoutingContext, type: Cache.Type) {
    val vertx = ctx.vertx()
    val bus = vertx.eventBus()
    val resp = ctx.response()
    val id = ctx.pathParam("id")
    val entityFetchResp = bus
      .request<ShelfVerticle.FetchResponse>("shelf.request.fetch", ShelfVerticle.FetchRequest(id))
      .await()
      .body()
    if(entityFetchResp == null) {
      resp.statusCode = 404
      resp.end("File not found")
      return
    }
    val entity = entityFetchResp.entity
    val cacheFetchResp = bus
      .request<CacheVerticle.FetchResponse>("cache.request.fetch", CacheVerticle.FetchRequest(entity, type))
      .await()
      .body()
    resp.putHeader("Content-Type", entity.mimeType)
    resp.sendFile(cacheFetchResp.path).await()
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
