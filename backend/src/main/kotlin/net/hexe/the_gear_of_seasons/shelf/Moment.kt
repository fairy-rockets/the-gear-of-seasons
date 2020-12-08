package net.hexe.the_gear_of_seasons.shelf

class Moment {
}

sealed class Block {

}

class ParagraphBlock(val text: String) : Block() {

}

class ImageBlock(val entityID: String?, val link: String?) : Block() {

}

class VideoBlock(val entityID: String?) : Block() {

}

class AudioBlock(val entityID: String?) : Block() {

}

class LinkBlock(val entityID: String?, val text: String?) : Block() {

}

class MarkdownBlock(val url: String?) : Block() {

}
