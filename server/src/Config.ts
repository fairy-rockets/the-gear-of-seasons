import { parseGAMeasurementID } from './lib/GoogleAnalytics.js';

const kOmoteHost = process.env['OMOTE_HOST'] || 'hexe.net';

const kConfig = {
  omoteHost:  kOmoteHost,
  uraHost:    process.env['URA_HOST'] || 'ura.hexe.net',
  dbHostname: process.env['DB_HOST'] || 'postgres',
  // canonical/OGP の絶対URLを組む基準。プレビュー用コンテナなど https でない環境では
  // OMOTE_ORIGIN で上書きする。
  omoteOrigin: process.env['OMOTE_ORIGIN'] || `https://${kOmoteHost}`,
  // YouTube Data API v3 のキー。無くても起動し、YouTube の動画の取り込み（/embed）と作り直しだけができない。
  youtubeApiKey: process.env['YOUTUBE_API_KEY'] || null,
  // GA4 の測定 ID。無ければ omote は gtag.js を読み込まず、イベントはページ内の dataLayer に溜まるだけになる。
  gaMeasurementID: parseGAMeasurementID(process.env['GA_MEASUREMENT_ID']),
};

export default kConfig;
