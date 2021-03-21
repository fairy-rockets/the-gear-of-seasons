package net.hexe.the_gear_of_seasons.omote

import io.vertx.core.http.HttpServer
import io.vertx.core.impl.logging.LoggerFactory
import io.vertx.ext.web.Route
import io.vertx.ext.web.Router
import io.vertx.ext.web.RoutingContext
import io.vertx.ext.web.handler.StaticHandler
import io.vertx.kotlin.coroutines.CoroutineVerticle
import io.vertx.kotlin.coroutines.await
import kotlinx.coroutines.launch
import net.hexe.the_gear_of_seasons.omote.controller.EntityController
import net.hexe.the_gear_of_seasons.omote.controller.IndexController

class OmoteVerticle : CoroutineVerticle() {
  private val log = LoggerFactory.getLogger("MainVerticle")
  private lateinit var http: HttpServer

  override suspend fun start() {
    // Let's dance!
    http = vertx
      .createHttpServer()
      .requestHandler(createRouter())
      .listen(8888).await()
    log.info("Server started")
  }

  override suspend fun stop() {
    http.close() { result ->
      if(result.succeeded()){
        log.info("Server stopped")
      } else {
        log.error("Server cannot stop gracefully", result.cause())
      }
    }
  }

  private fun createRouter() = Router.router(vertx).apply {
    run {
      val controller = IndexController()
      handle(get("/"), controller::index)
    }
    run {
      route("/static/*").handler(StaticHandler.create("omote/static"))
    }
    run {
      val controller = EntityController()
      handle(get("/entity/:id"), controller::serveFull)
      handle(get("/entity/:id/icon"), controller::serveIcon)
      handle(get("/entity/:id/medium"), controller::serveMedium)
    }
  }

  // Handling routes
  private fun runHandler(ctx: RoutingContext, fn: suspend (RoutingContext) -> Unit) {
    launch {
      try {
        fn(ctx)
        if(!ctx.response().ended()) {
          ctx.end().await()
        }
      } catch (e: Throwable) {
        log.error("Unknown error", e)
        ctx.fail(e)
      }
    }
  }
  private fun handle(route: Route, fn: suspend (RoutingContext) -> Unit) {
    route.handler { ctx ->
      runHandler(ctx, fn)
    }
  }
}
