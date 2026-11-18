// GA4 の測定 ID（G- で始まる英大文字と数字）。omote の <script> にそのまま埋め込むので、形を確かめてから使う。
const kMeasurementIDPattern = /^G-[A-Z0-9]+$/;

/**
 * 環境変数 GA_MEASUREMENT_ID の値を読む。
 * 空や未設定なら null を返し、omote は gtag.js を読み込まない（開発環境はこれ）。
 * 形が違うときは、本番で計測が止まったことに気づけないので、起動時に例外を投げる。
 */
export function parseGAMeasurementID(value: string | undefined): string | null {
  if (value === undefined || value === '') {
    return null;
  }
  if (!kMeasurementIDPattern.test(value)) {
    throw new Error(`GA_MEASUREMENT_ID must look like "G-XXXXXXXXXX": ${JSON.stringify(value)}`);
  }
  return value;
}
