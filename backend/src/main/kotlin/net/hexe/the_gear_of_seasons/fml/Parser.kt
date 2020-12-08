package net.hexe.the_gear_of_seasons.fml

import net.hexe.the_gear_of_seasons.shelf.*
import java.lang.Integer.min

class Parser(buf: String) {
  val buff: String = buf
  var pos: Int = 0
  /* **************************************************************************
   * Looking Ahead
   ************************************************************************* */
  private fun look1(): Char? {
    return if (pos < buff.length) {
      buff[pos]
    } else {
      null
    }
  }
  private fun lookUntil(p: (Char) -> Boolean): Pair<String, Int> {
    val result = StringBuffer()
    var cur = pos
    while(cur < buff.length && p(buff[cur])) {
      result.append(buff[cur])
      cur++
    }
    return Pair(result.toString(), cur - pos)
  }
  /* **************************************************************************
   * Buffer Consumer
   ************************************************************************* */
  private fun consume(n: Int): String {
    val str = buff.substring(pos, pos+n)
    pos = min(buff.length, pos + n)
    return str
  }
  private fun consumeUntil(p: (Char) -> Boolean): String {
    val result = StringBuffer()
    while(!eof() && p(buff[pos])) {
      result.append(buff[pos])
      pos++
    }
    return result.toString()
  }
  /* **************************************************************************
   * Asserting
   ************************************************************************* */
  private fun expect(expected: String) {
    val actual = consume(expected.length)
    if(actual != expected) {
      throw ParseError()
    }
  }
  /* **************************************************************************
   * Skips
   ************************************************************************* */
  private fun skipSpaces() {
    while(!eof() && buff[pos] == ' ') {
      pos++
    }
  }
  private fun skipLines() {
    while(!eof() && buff[pos] == '\n' || buff[pos] == '\r') {
      pos++
    }
  }
  /* **************************************************************************
   * Observe states
   ************************************************************************* */
  private fun eof():Boolean = buff.length <= pos

  /* **************************************************************************
   * Items
   ************************************************************************* */
  private fun parseKey(): String {
    return "TODO"
  }
  private fun parseValue(): String {
    return "TODO"
  }
  private fun parseBracket(): MutableMap<String, String> {
    skipSpaces()
    val map = mutableMapOf<String, String>()
    while(look1() != ']') {
      val key = parseKey()
      skipSpaces()
      skipSpaces()
    }
    return map
  }
  private fun parseEmbedding(): Block? {
    expect("[")
    skipSpaces()
    val word = lookUntil { ch -> !ch.isWhitespace() }
    return when(word.first.toLowerCase()) {
      "image" -> {
        consume(word.second)
        val map = parseBracket()
        ImageBlock(map["entity"], map["link"])
      }
      "video" -> {
        consume(word.second)
        val map = parseBracket()
        VideoBlock(map["entity"])
      }
      "audio" -> {
        consume(word.second)
        val map = parseBracket()
        AudioBlock(map["entity"])
      }
      "link" -> {
        consume(word.second)
        val map = parseBracket()
        LinkBlock(map["entity"], map["text"])
      }
      "markdown" -> {
        consume(word.second)
        val map = parseBracket()
        MarkdownBlock(map["url"])
      }
      else -> null
    }
  }
  private fun parseParagraph(): ParagraphBlock {
    val buff = StringBuffer()
    do {
      buff.append(consumeUntil{ch -> ch != '[' || ch == '\n'})
    } while(!eof() && look1() != '\n')
    return ParagraphBlock(buff.toString())
  }
  fun parse() {
    skipLines()
    val blocks = mutableListOf<Block>()
    while(!eof()) {
      val link = parseEmbedding()
      if(link != null) {
        continue
      }
      blocks.add(parseParagraph())
    }
  }
}

