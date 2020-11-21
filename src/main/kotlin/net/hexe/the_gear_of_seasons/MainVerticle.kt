package net.hexe.the_gear_of_seasons

import io.vertx.core.AbstractVerticle
import io.vertx.core.Promise
import io.vertx.core.http.HttpServer
import io.vertx.core.impl.logging.LoggerFactory
import io.vertx.ext.web.Route
import io.vertx.ext.web.Router
import io.vertx.ext.web.RoutingContext
import io.vertx.kotlin.coroutines.CoroutineVerticle
import io.vertx.kotlin.coroutines.await
import kotlinx.coroutines.launch
import net.hexe.the_gear_of_seasons.controller.IndexController

class MainVerticle : CoroutineVerticle() {
  private val log = LoggerFactory.getLogger("MainVerticle")
  private lateinit var http: HttpServer
  override suspend fun start() {
    http = vertx
      .createHttpServer()
      .requestHandler(createRouter())
      http.listen(8888, "0.0.0.0")
      .onSuccess {
        log.info("Server started")
      }
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
  }

  // Kotlin CoroutineからHandlerに変換する、ある意味核心部分。
  private fun handle(route: Route, fn: suspend (RoutingContext) -> Unit) {
    route.handler { ctx ->
      launch {
        try {
          fn(ctx)
          if(!ctx.response().ended()) {
            ctx.response().end()
          }
        } catch (e: Throwable) {
          log.error("Unknown error", e)
          ctx.fail(e)
        }
      }
    }
  }
}
