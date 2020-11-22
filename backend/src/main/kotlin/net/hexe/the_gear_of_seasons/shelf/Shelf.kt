package net.hexe.the_gear_of_seasons.shelf

import io.vertx.core.Vertx
import io.vertx.core.impl.logging.Logger
import io.vertx.core.impl.logging.LoggerFactory
import io.vertx.kotlin.coroutines.await
import org.yaml.snakeyaml.Yaml
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.OutputStreamWriter
import java.nio.file.Paths
import java.util.*

class Shelf(private val vertx: Vertx, private val path: String) {
  private val log: Logger = LoggerFactory.getLogger("Shelf")
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
    val buff = ByteArrayOutputStream()
    var yamlExt = ".yml"
    OutputStreamWriter(buff).use { writer ->
      when (entity) {
        is Image -> {
          val image: Image = entity
          Yaml(constructorOf(Image::class)).dump(image, writer)
          yamlExt = ".image.yml"
        }
        is Video -> {
          val video: Video = entity
          Yaml(constructorOf(Video::class)).dump(video, writer)
          yamlExt = ".video.yml"
        }
        is Audio -> {
          val audio: Audio = entity
          Yaml(constructorOf(Image::class)).dump(audio, writer)
          yamlExt = ".audio.yml"
        }
      }
    }
    val year = run {
      val cal = Calendar.getInstance()
      cal.time = entity.date
      cal.get(Calendar.YEAR)
    }
    val bytes = buff.toByteArray()
    val dir = Paths.get(path, year.toString()).toString()
    vertx.fileSystem().mkdirs(dir).await()
    val yamlPath = Paths.get(dir, entity.metaFilename()).toString()
    val dataPath = Paths.get(dir, entity.dataFilename()).toString()
  }
  private suspend fun loadEntity(ymlPath: String) {
    val buff = vertx.fileSystem().readFile(ymlPath).await()
    when {
      ymlPath.endsWith(Image.kYamlExtension) -> {
        val id = ymlPath.removeSuffix(Image.kYamlExtension)
        val entity = Yaml(constructorOf(Image::class)).load<Image>(ByteArrayInputStream(buff.bytes))
        entity.id = id
        this.entities[id] = entity
      }
      ymlPath.endsWith(Video.kYamlExtension) -> {
        val id = ymlPath.removeSuffix(Video.kYamlExtension)
        val entity = Yaml(constructorOf(Video::class)).load<Video>(ByteArrayInputStream(buff.bytes))
        entity.id = id
        this.entities[id] = entity
      }
      ymlPath.endsWith(Audio.kYamlExtension) -> {
        val id = ymlPath.removeSuffix(Audio.kYamlExtension)
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
