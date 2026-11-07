const OmoteHost = process.env['OMOTE_HOST'] || 'hexe.net';

const Config = {
  OmoteHost:  OmoteHost,
  UraHost:    process.env['URA_HOST'] || 'ura.hexe.net',
  dbHostname: process.env['DB_HOST'] || 'postgres',
  // canonical/OGP の絶対URLを組む基準。プレビュー用コンテナなど https でない環境では
  // OMOTE_ORIGIN で上書きする。
  OmoteOrigin: process.env['OMOTE_ORIGIN'] || `https://${OmoteHost}`,
  // YouTube Data API v3 のキー。無くても起動し、YouTube の動画の取り込み（/embed）と作り直しだけができない。
  youtubeApiKey: process.env['YOUTUBE_API_KEY'] || null,
};

export default Config;
