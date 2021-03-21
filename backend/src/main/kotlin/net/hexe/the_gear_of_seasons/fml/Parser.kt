package net.hexe.the_gear_of_seasons.fml

import java.lang.StringBuilder

class Parser(buf: String) {
  private val buff: String = buf
  private var pos: Int = 0
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
    return consumeUntil { c -> c.isLetterOrDigit() }
  }
  private fun parseValue(): String {
    expect("\"")
    val buff = StringBuffer()
    while(!eof()) {
      val c1 = look1() ?: throw ParseError()
      when(c1) {
        '"' -> break
        '\\' -> {
          val c2 = look1() ?: throw ParseError()
          when(c2) {
            '"' -> buff.append('"')
            'r' -> buff.append('\r')
            'n' -> buff.append('\n')
            else -> buff.append(c2)
          }
          consume(1)
        }
        else -> buff.append(c1)
      }
      consume(1)
    }
    expect("\"")
    return buff.toString()
  }
  private fun parseEmbeddingMap(): MutableMap<String, String> {
    skipSpaces()
    val map = mutableMapOf<String, String>()
    while(look1() != ']') {
      val key = parseKey()
      skipSpaces()
      expect("=")
      skipSpaces()
      val value = parseValue()
      map[key] = value
      skipSpaces()
    }
    expect("]")
    return map
  }
  private fun parseEmbedding(): Block {
    expect("[")
    skipSpaces()
    val word = lookUntil { ch -> !ch.isWhitespace() }
    return when (word.first.toLowerCase()) {
      "image" -> {
        consume(word.second)
        val map = parseEmbeddingMap()
        ImageBlock(map["entity"], map["link"])
      }
      "video" -> {
        consume(word.second)
        val map = parseEmbeddingMap()
        VideoBlock(map["entity"])
      }
      "audio" -> {
        consume(word.second)
        val map = parseEmbeddingMap()
        AudioBlock(map["entity"])
      }
      "link" -> {
        consume(word.second)
        val map = parseEmbeddingMap()
        LinkBlock(map["entity"], map["text"])
      }
      "markdown" -> {
        consume(word.second)
        val map = parseEmbeddingMap()
        MarkdownBlock(map["url"])
      }
      else -> throw ParseError()
    }
  }
  private fun parseParagraph(): ParagraphBlock {
    val buff = StringBuilder()
    buff.append(consume1())
    do {
      val str = consumeUntil{ch -> ch != '[' || ch == '\n'}
      buff.append(str)
      val next = look1()
    } while(!eof() && next != '\n' && next != '[' && str.isNotEmpty())
    return ParagraphBlock(buff.toString().trim())
  }
  fun parse(): Array<Block> {
    skipLines()
    val blocks = mutableListOf<Block>()
    while(!eof()) {
      if(look1() == '[') {
        val embed = tryParse { parseEmbedding() }
        if (embed != null) {
          blocks.add(embed)
          continue
        }
      }
      blocks.add(parseParagraph())
    }
    return blocks.toTypedArray()
  }
}

