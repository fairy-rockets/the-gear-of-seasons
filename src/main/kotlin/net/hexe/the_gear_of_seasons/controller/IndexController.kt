package net.hexe.the_gear_of_seasons.controller

import io.vertx.ext.web.RoutingContext
import io.vertx.kotlin.coroutines.await

class IndexController {
  suspend fun index(ctx: RoutingContext) {
    val resp = ctx.response()
    resp.end("Hello world!").await()
  }
}
