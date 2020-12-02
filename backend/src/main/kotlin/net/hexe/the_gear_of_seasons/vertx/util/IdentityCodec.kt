package net.hexe.the_gear_of_seasons.vertx.util

import io.vertx.core.buffer.Buffer
import io.vertx.core.eventbus.MessageCodec

class IdentityCodec<T>(private val clazz: Class<T>) : MessageCodec<T, T> {
  override fun encodeToWire(buffer: Buffer?, o: T) {}
  override fun decodeFromWire(pos: Int, buffer: Buffer?): T? {
    return null
  }

  override fun transform(o: T): T {
    return o
  }

  override fun name(): String {
    return "${clazz.name}Codec"
  }

  override fun systemCodecID(): Byte {
    return -1
  }
}
