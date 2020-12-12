package net.hexe.the_gear_of_seasons.shelf

class Moment {
}

sealed class Block {

}

class ParagraphBlock(val text: String) : Block() {
  override fun equals(other: Any?): Boolean {
    if(other is ParagraphBlock) {
      return other.text == text
    }
    return false
  }
  override fun hashCode(): Int {
    return text.hashCode()
  }

  override fun toString(): String {
    return text
  }
}

class ImageBlock(val entityID: String?, val link: String?) : Block() {
  override fun equals(other: Any?): Boolean {
    if(other is ImageBlock) {
      return other.entityID == entityID && other.link == link
    }
    return false
  }

  override fun hashCode(): Int {
    var result = entityID?.hashCode() ?: 0
    result = 31 * result + (link?.hashCode() ?: 0)
    return result
  }

  override fun toString(): String {
    return "[]"
  }
}

class VideoBlock(val entityID: String?) : Block() {

}

class AudioBlock(val entityID: String?) : Block() {

}

class LinkBlock(val entityID: String?, val text: String?) : Block() {

}

class MarkdownBlock(val url: String?) : Block() {

}
