import { describe, it } from 'mocha';
import assert from 'assert';

import { parseGAMeasurementID } from './GoogleAnalytics.js';

describe("parseGAMeasurementID", () => {
  it("未設定と空は null（gtag.js を読み込まない）", () => {
    assert.strictEqual(parseGAMeasurementID(undefined), null);
    assert.strictEqual(parseGAMeasurementID(''), null);
  });

  it("G- で始まる ID をそのまま返す", () => {
    assert.strictEqual(parseGAMeasurementID('G-0F6HPJ1L2Y'), 'G-0F6HPJ1L2Y');
  });

  for (const value of ['UA-12345-1', 'g-0f6hpj1l2y', 'G-', "G-X'); alert(1); ('", ' G-0F6HPJ1L2Y']) {
    it(`形の違う値は例外を投げる: ${JSON.stringify(value)}`, () => {
      assert.throws(() => parseGAMeasurementID(value), /GA_MEASUREMENT_ID/);
    });
  }
});
