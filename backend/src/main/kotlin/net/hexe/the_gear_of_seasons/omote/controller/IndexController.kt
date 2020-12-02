package net.hexe.the_gear_of_seasons.omote.controller

import io.vertx.ext.web.RoutingContext
import io.vertx.ext.web.templ.handlebars.HandlebarsTemplateEngine
import io.vertx.kotlin.coroutines.await

class IndexController {
  suspend fun index(ctx: RoutingContext) {
    val templ = HandlebarsTemplateEngine.create(ctx.vertx())
    val resp = ctx.response()
    resp.end(templ.render(mutableMapOf(), "omote/templates/index").await()).await()
  }
}
