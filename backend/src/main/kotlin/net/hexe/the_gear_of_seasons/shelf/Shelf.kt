package net.hexe.the_gear_of_seasons.shelf

import io.vertx.core.Vertx
import io.vertx.core.impl.logging.Logger
import io.vertx.core.impl.logging.LoggerFactory
import io.vertx.ext.web.FileUpload
import io.vertx.kotlin.coroutines.await
import org.yaml.snakeyaml.Yaml
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.OutputStreamWriter
import java.nio.file.Path
import java.nio.file.Paths

class Shelf(private val vertx: Vertx, private val path: String) {
  private val log: Logger = LoggerFactory.getLogger("Shelf")
  val entities: MutableMap<String, Entity> = mutableMapOf()
  suspend fun init() {
    val fs = vertx.fileSystem()
    for(yearPath in fs.readDir(path).await()) {
      if(!fs.lprops(yearPath).await().isDirectory) {
        continue
      }
      for(ymlPath in fs.readDir(yearPath, ".*\\.yml").await()) {
        val prop = fs.lprops(ymlPath).await()
        if(!prop.isRegularFile) {
          continue
        }
        loadEntity(Path.of(ymlPath))
      }
    }
  }
  private suspend fun saveImage(file: FileUpload) {
    file.uploadedFileName()
  }
  private suspend fun saveEntity(entity: Entity) {
    val buff = ByteArrayOutputStream()
    val fs = vertx.fileSystem()
    OutputStreamWriter(buff).use { writer ->
      when (entity) {
        is Image -> {
          val image: Image = entity
          Yaml(constructorOf(Image::class)).dump(image, writer)
        }
        is Video -> {
          val video: Video = entity
          Yaml(constructorOf(Video::class)).dump(video, writer)
        }
        is Audio -> {
          val audio: Audio = entity
          Yaml(constructorOf(Image::class)).dump(audio, writer)
        }
      }
    }
    val year = entity.localTime().year
    val bytes = buff.toByteArray()
    val dir = Paths.get(path, year.toString()).toString()
    fs.mkdirs(dir).await()
    val yamlPath = Paths.get(dir, entity.metaFilename()).toString()
    val dataPath = Paths.get(dir, entity.dataFilename()).toString()
  }
  private suspend fun loadEntity(ymlPath: Path) {
    val fs = vertx.fileSystem()
    val buff = fs.readFile(ymlPath.toAbsolutePath().toString()).await()
    val metaFilename = ymlPath.fileName.toString()
    val dir = ymlPath.parent.toAbsolutePath().toString()
    when {
      metaFilename.endsWith(Image.kYamlExtension) -> {
        val id = metaFilename.removeSuffix(Image.kYamlExtension)
        val entity = Yaml(constructorOf(Image::class)).load<Image>(ByteArrayInputStream(buff.bytes))
        entity.id = id
        entity.dir = dir
        this.entities[id] = entity
      }
      metaFilename.endsWith(Video.kYamlExtension) -> {
        val id = metaFilename.removeSuffix(Video.kYamlExtension)
        val entity = Yaml(constructorOf(Video::class)).load<Video>(ByteArrayInputStream(buff.bytes))
        entity.id = id
        entity.dir = dir
        this.entities[id] = entity
      }
      metaFilename.endsWith(Audio.kYamlExtension) -> {
        val id = metaFilename.removeSuffix(Audio.kYamlExtension)
        val entity = Yaml(constructorOf(Audio::class)).load<Audio>(ByteArrayInputStream(buff.bytes))
        entity.id = id
        entity.dir = dir
        this.entities[id] = entity
      }
      else -> {
        log.warn("Unknown file type: $ymlPath")
      }
    }
  }
}
