package net.hexe.the_gear_of_seasons.shelf

import io.vertx.core.CompositeFuture
import io.vertx.core.Future
import io.vertx.core.Vertx
import io.vertx.core.impl.logging.Logger
import io.vertx.core.impl.logging.LoggerFactory
import io.vertx.kotlin.coroutines.await
import java.nio.file.Path
import java.nio.file.Paths

class Cache(private val vertx: Vertx, private val path: String) {
  private val log: Logger = LoggerFactory.getLogger("Cache")
  enum class Type {
    Full,
    Medium,
    Icon,
  }
  companion object {
    const val kMediumSize = 2048
    const val kIconSize = 256
  }
  private fun execute(vararg rawArgs: String) {
    val args = ArrayList<String>()
    args.addAll(rawArgs)
    val process =
      ProcessBuilder(args)
        .redirectErrorStream(true)
        .start()
    val stdout = process.inputStream.bufferedReader()
    process.waitFor()
    val result = process.exitValue()
    val msg = stdout.readText()
    if(result != 0) {
      throw RuntimeException("Failed to convert:\n*** arg ***\n${args}\n*** out ***\n${msg}")
    }
    log.info("Done: $args")
  }
  private suspend fun prepareImage(image: Image): MutableList<Future<Unit>> {
    val frag = image.id.take(2)
    val fs = vertx.fileSystem()
    fs.mkdirs(Paths.get(path, "medium", frag).toString())
    fs.mkdirs(Paths.get(path, "icon", frag).toString())
    val tasks = mutableListOf<Future<Unit>>()
    val mediumPath = Paths.get(path,"medium", frag, "${image.id}.jpg").toString()
    val iconPath = Paths.get(path,"icon", frag, "${image.id}.jpg").toString()
    if(!fs.exists(mediumPath).await()) {
      tasks.add(vertx.executeBlocking { handler ->
        val width: Int
        val height: Int
        if(image.width > image.height) {
          width = kMediumSize
          height = -1
        } else {
          width = -1
          height = kMediumSize
        }
        try {
          execute(
            "ffmpeg", "-y",
            "-i", image.dataPath(),
            "-vf", "scale=%d:%d".format(width, height),
            mediumPath)
          handler.complete()
        } catch(it: Throwable) {
          handler.fail(it)
        }
      })
    }
    if(!fs.exists(iconPath).await()) {
      tasks.add(vertx.executeBlocking { handler ->
        val width: Int
        val height: Int
        if(image.width > image.height) {
          width = -1
          height = kIconSize
        } else {
          width = kIconSize
          height = -1
        }
        try {
          execute(
            "ffmpeg", "-y",
            "-i", image.dataPath(),
            "-vf", "scale=%d.1:%d.1,crop=%d:%d".format(width, height, kIconSize, kIconSize),
            iconPath)
          handler.complete()
        } catch (it: Throwable) {
          handler.fail(it)
        }
      })
    }
    return tasks
  }
  private suspend fun prepareVideo(video: Video): MutableList<Future<Unit>> {
    return mutableListOf()
  }
  private suspend fun prepareAudio(audio: Audio): MutableList<Future<Unit>> {
    return mutableListOf()
  }
  private suspend fun prepare(entity: Entity): MutableList<Future<Unit>> =
    when(entity) {
      is Image -> prepareImage(entity)
      is Video -> prepareVideo(entity)
      is Audio -> prepareAudio(entity)
    }

  suspend fun prepare() {
    val tasks = mutableListOf<Future<Unit>>()
    val bus = vertx.eventBus()
    val entities =
      bus.request<ShelfVerticle.ListResponse>("shelf.request.list", ShelfVerticle.ListRequest(null))
      .await().body().entities
    for(entity in entities) {
      tasks.addAll(prepare(entity))
    }
    CompositeFuture.join(tasks.toList()).onSuccess {
      log.info("Cache Prepared!!")
    }.onFailure {
      log.error("Cache Preparation: Failed!", it)
    }.await()
  }
}
