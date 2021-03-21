package net.hexe.the_gear_of_seasons.fml

import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Test

class ParserTest {
  @Test
  fun testBasic() {
    run {
      assertArrayEquals(arrayOf(
        ParagraphBlock("test")
      ),
        Parser("test").parse()
      )
    }
    run {
      val p = Parser("[image entity=\"test\"]")
      assertArrayEquals(arrayOf(
        ImageBlock("test", null)), p.parse())
    }
    run {
      assertArrayEquals(arrayOf(
        ParagraphBlock("aa"),
        ImageBlock("test", null),
        ParagraphBlock("aa"),
      ),
        Parser("aa [image entity=\"test\"] aa").parse()
      )
    }
  }
  @Test
  fun testInvalidBlock() {
    run {
      assertArrayEquals(arrayOf(
        ParagraphBlock("[image entity=\"test\"")
      ),
        Parser("[image entity=\"test\"").parse()
      )
    }
    run {
      assertArrayEquals(arrayOf(
        ParagraphBlock("aa"),
        ParagraphBlock("[image entity=\"test\""),
      ),
        Parser("aa [image entity=\"test\"").parse()
      )
    }
    run {
      assertArrayEquals(arrayOf(
        ParagraphBlock("[image entity=\"test\" aa]")
      ),
        Parser("[image entity=\"test\" aa]").parse()
      )
    }
  }
}
