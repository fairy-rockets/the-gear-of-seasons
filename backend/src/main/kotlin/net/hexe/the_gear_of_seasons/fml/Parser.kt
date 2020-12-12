package net.hexe.the_gear_of_seasons.fml

import net.hexe.the_gear_of_seasons.shelf.*
import java.lang.StringBuilder

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
    val result = StringBuilder()
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
    return if (pos + n <= buff.length) {
      val str = buff.substring(pos, pos+n)
      pos += n
      str
    } else {
      throw ParseError()
    }
  }
  private fun consume1(): Char {
    return if (pos < buff.length) {
      val c = buff[pos]
      pos++
      c
    } else {
      throw ParseError()
    }
  }
  private fun consumeUntil(p: (Char) -> Boolean): String {
    val result = StringBuilder()
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
   * Observe states
   ************************************************************************* */
  private fun <R> tryParse(p: () -> R): R? {
    val original = pos
    return try {
      p()
    } catch(e: ParseError) {
      pos = original
      null
    }
  }
  /* **************************************************************************
   * Items
   ************************************************************************* */
  private fun parseKey(): String {
    return consumeUntil { p -> p.isLetterOrDigit() }
  }
  private fun parseValue(): String {
    expect("\"")
    val sb = StringBuilder()
    while(look1() != '"') {
      val ch = consume1()
      if(ch == '\\') {
        val next = consume1()
        when(next) {
          'n' -> sb.append('\n')
          'r' -> sb.append('\r')
          '\\' -> sb.append('\\')
          else -> throw ParseError()
        }
      } else {
        sb.append(ch)
      }
    }
    expect("\"")
    return sb.toString()
  }
  private fun parseBracket(): MutableMap<String, String> {
    skipSpaces()
    val map = mutableMapOf<String, String>()
    while(look1() != ']') {
      val key = parseKey()
      skipSpaces()
      expect("=")
      skipSpaces()
      val value = parseValue()
      skipSpaces()
      map[key] = value
    }
    expect("]")
    return map
  }
  private fun parseEmbedding(): Block {
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
      else -> throw ParseError()
    }
  }
  private fun parseParagraph(): ParagraphBlock {
    val buff = StringBuilder()
    skipSpaces()
    buff.append(consume1())
    do {
      buff.append(consumeUntil { ch -> ch != '[' || ch == '\n' })
    } while(!eof() && look1() != '\n')
    return ParagraphBlock(buff.toString())
  }
  fun parse(): List<Block> {
    skipLines()
    val blocks = mutableListOf<Block>()
    while(!eof()) {
      val embed = tryParse(this::parseEmbedding)
      if(embed != null) {
        blocks.add(embed)
        continue
      }
      blocks.add(parseParagraph())
    }
    return blocks
  }
}

