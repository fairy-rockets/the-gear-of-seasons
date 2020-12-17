package net.hexe.the_gear_of_seasons.fml

import net.hexe.the_gear_of_seasons.shelf.ImageBlock
import net.hexe.the_gear_of_seasons.shelf.ParagraphBlock
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

internal class ParserTest {
  @Test
  fun parseSuccess() {
    run {
      val p = Parser("test")
      val result = p.parse()
      assertEquals(listOf(ParagraphBlock("test")), result)
    }
    run {
      val p = Parser("[image entity=\"test\"]")
      val result = p.parse()
      assertEquals(listOf(ImageBlock("test", null)), result)
    }
    run {
      val p = Parser("[image entity=\"test\" a")
      val result = p.parse()
      assertEquals(listOf(ParagraphBlock("[image entity=\"test\" a")), result)
    }
  }
}
