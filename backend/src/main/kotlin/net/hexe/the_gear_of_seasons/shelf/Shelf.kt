package net.hexe.the_gear_of_seasons.shelf

import io.vertx.core.Vertx
import io.vertx.core.impl.logging.LoggerFactory
import io.vertx.kotlin.coroutines.await
import org.yaml.snakeyaml.Yaml
import java.io.ByteArrayInputStream

class Shelf(val vertx: Vertx, val path: String) {
  val log = LoggerFactory.getLogger("Shelf")
  val entities: MutableMap<String, Entity> = mutableMapOf()
  suspend fun init() {
    for(yearPath in vertx.fileSystem().readDir(path).await()) {
      if(!vertx.fileSystem().lprops(yearPath).await().isDirectory){
        continue
      }
      for(ymlPath in vertx.fileSystem().readDir(yearPath, ".*\\.yml").await()) {
        val prop = vertx.fileSystem().lprops(ymlPath).await()
        if(!prop.isRegularFile) {
          continue
        }
        loadEntity(ymlPath)
      }
    }
  }
  private suspend fun saveEntity(entity: Entity) {
    when (entity) {
      is Image -> {
        val image: Image = entity
      }
      is Video -> {
        val video: Video = entity
      }
      is Audio -> {
        val audio: Audio = entity
      }
    }
  }
  private suspend fun loadEntity(ymlPath: String) {
    val buff = vertx.fileSystem().readFile(ymlPath).await()
    when {
      ymlPath.endsWith(".image.yml") -> {
        val id = ymlPath.removeSuffix(".image.yml")
        val entity = Yaml(constructorOf(Image::class)).load<Image>(ByteArrayInputStream(buff.bytes))
        entity.id = id
        this.entities[id] = entity
      }
      ymlPath.endsWith(".video.yml") -> {
        val id = ymlPath.removeSuffix(".video.yml")
        val entity = Yaml(constructorOf(Video::class)).load<Video>(ByteArrayInputStream(buff.bytes))
        entity.id = id
        this.entities[id] = entity
      }
      ymlPath.endsWith(".audio.yml") -> {
        val id = ymlPath.removeSuffix(".audio.yml")
        val entity = Yaml(constructorOf(Audio::class)).load<Audio>(ByteArrayInputStream(buff.bytes))
        entity.id = id
        this.entities[id] = entity
      }
      else -> {
        log.warn("Unknown file type: $ymlPath")
      }
    }
  }
}
