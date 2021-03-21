package net.hexe.the_gear_of_seasons.fml

import net.hexe.the_gear_of_seasons.shelf.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class ParserTest {
  @Test
  fun testBasic() {
    val p = Parser("test")
    assertArrayEquals(arrayOf(ParagraphBlock("test")), p.parse())
  }
  @Test
  fun testImage() {
    val p = Parser("[image entity=\"test\"]")
    assertArrayEquals(arrayOf(ImageBlock("test", null)), p.parse())
  }
  @Test
  fun testCombined() {
    val p = Parser("aa [image entity=\"test\"] aa")
    assertArrayEquals(arrayOf(
      ParagraphBlock("aa"),
      ImageBlock("test", null),
      ParagraphBlock("aa"),
    ), p.parse())
  }
}
