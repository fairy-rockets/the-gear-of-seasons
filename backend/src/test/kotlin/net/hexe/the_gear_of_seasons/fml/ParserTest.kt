package net.hexe.the_gear_of_seasons.fml

import net.hexe.the_gear_of_seasons.shelf.ParagraphBlock
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

internal class ParserTest {
  @Test
  fun parseSuccess() {
    val p = Parser("test")
    val result = p.parse()
    assertEquals(listOf(ParagraphBlock("test")), result)
  }
}
