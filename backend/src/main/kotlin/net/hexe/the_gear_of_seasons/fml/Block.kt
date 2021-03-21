package net.hexe.the_gear_of_seasons.fml

sealed class Block {
}
data class ParagraphBlock(val text: String) : Block()
data class ImageBlock(val entityID: String?, val link: String?) : Block()
data class VideoBlock(val entityID: String?) : Block()
data class AudioBlock(val entityID: String?) : Block()
data class LinkBlock(val entityID: String?, val text: String?) : Block()
data class MarkdownBlock(val url: String?) : Block()
