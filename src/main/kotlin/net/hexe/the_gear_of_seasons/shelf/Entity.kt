package net.hexe.the_gear_of_seasons.shelf

import de.beosign.snakeyamlanno.property.YamlProperty
import org.yaml.snakeyaml.constructor.Constructor
import org.yaml.snakeyaml.introspector.Property
import org.yaml.snakeyaml.introspector.PropertyUtils
import java.util.*
import kotlin.reflect.KClass

sealed class Entity() {
  var id: String = ""
  var description: String = ""
  var date: Date = Date(0)
  @YamlProperty(key = "mime-type")
  var mimeType: String = "application/octet-stream"
}

class Image() : Entity() {
  var width: Int = 0
  var height: Int = 0
}

class Video() : Entity() {
}

class Audio() : Entity() {
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

