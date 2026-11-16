import { describe, it } from 'mocha';
import assert from 'assert';

import { internalTrafficSetCookie } from './InternalTraffic.js';

describe("運営者の閲覧の印", () => {
  it("ura が omote のサブドメインなら、omote のドメインに Cookie を付ける", () => {
    assert.strictEqual(
      internalTrafficSetCookie('hexe.net', 'ura.hexe.net', 'https://hexe.net'),
      'gear_internal=1; Domain=hexe.net; Path=/; Max-Age=31536000; SameSite=Lax; Secure');
  });

  it("https でなければ Secure を付けない", () => {
    assert.strictEqual(
      internalTrafficSetCookie('hexe.test', 'ura.hexe.test', 'http://hexe.test:8889'),
      'gear_internal=1; Domain=hexe.test; Path=/; Max-Age=31536000; SameSite=Lax');
  });

  for (const [omote, ura] of [['hexe.net', 'ura.example.net'], ['hexe.net', 'urahexe.net'], ['hexe.net', 'hexe.net']]) {
    it(`omote(${omote}) に届かない ura(${ura}) では付けない`, () => {
      assert.strictEqual(internalTrafficSetCookie(omote, ura, 'https://hexe.net'), null);
    });
  }

});
