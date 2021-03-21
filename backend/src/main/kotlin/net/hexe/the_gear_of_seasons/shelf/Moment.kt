package net.hexe.the_gear_of_seasons.shelf

import java.time.LocalDateTime
import java.time.ZoneId
import java.util.*

class Moment {
  var date: Date = Date(0)
  var title = ""
  var author = ""
  var text = ""

  fun localTime(): LocalDateTime = LocalDateTime.ofInstant(date.toInstant(), ZoneId.of("Asia/Tokyo"))
}
