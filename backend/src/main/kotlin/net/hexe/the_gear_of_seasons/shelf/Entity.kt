package net.hexe.the_gear_of_seasons.shelf

import de.beosign.snakeyamlanno.property.YamlProperty
import org.yaml.snakeyaml.constructor.Constructor
import org.yaml.snakeyaml.introspector.Property
import org.yaml.snakeyaml.introspector.PropertyUtils
import java.nio.file.Paths
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.*
import kotlin.reflect.KClass


sealed class Entity {
  var dir: String = ""
  var id: String = ""
  var description: String = ""
  var date: Date = Date(0)

  @YamlProperty(key = "mime-type")
  var mimeType: String = "application/octet-stream"
  abstract fun metaFilename(): String
  abstract fun dataFilename(): String
  fun metaPath(): String = Paths.get(dir, metaFilename()).toAbsolutePath().toString()
  fun dataPath(): String = Paths.get(dir, dataFilename()).toAbsolutePath().toString()
  fun localTime(): LocalDateTime = LocalDateTime.ofInstant(date.toInstant(), ZoneId.systemDefault())
}

class Image : Entity() {
  companion object {
    const val kYamlExtension = ".image.yml"
  }
  var width: Int = 0
  var height: Int = 0

  override fun metaFilename(): String {
    return "$id$kYamlExtension"
  }
  override fun dataFilename(): String =
    when(mimeType) {
      "image/gif" -> "$id.gif"
      "image/jpeg" -> "$id.jpg"
      "image/png" -> "$id.png"
      else -> "$id.?"
    }
}

class Video : Entity() {
  companion object {
    const val kYamlExtension = ".video.yml"
  }
  var width: Int = 0
  var height: Int = 0
  var duraton: Float = 0.0f

  override fun metaFilename(): String {
    return "$id${kYamlExtension}"
  }
  override fun dataFilename(): String =
    when(mimeType) {
      "video/mp4" -> "$id.mp4"
      "video/x-matroska" -> "$id.mkv"
      else -> "$id.?"
    }
}

class Audio : Entity() {
  companion object {
    const val kYamlExtension = ".audio.yml"
  }

  override fun metaFilename(): String {
    return "$id${kYamlExtension}"
  }
  override fun dataFilename(): String =
    when(mimeType) {
      else -> "$id.?"
    }
}

class EntityPropertyUtils : PropertyUtils() {
  override fun getProperty(type: Class<out Any?>?, originalName: String): Property? {
    var name = originalName
    if (name.indexOf('-') > -1) {
      name = name.split('-').withIndex().map { (idx, word) ->
        if(idx == 0) {
          word
        } else {
          word[0].toUpperCase() + word.substring(1)
        }
      }.joinToString("")
    }
    return super.getProperty(type, name)
  }
}

fun <T : Entity> constructorOf(clazz: KClass<T>): Constructor {
  val c = Constructor(clazz.java)
  c.propertyUtils = EntityPropertyUtils()
  return c
}

