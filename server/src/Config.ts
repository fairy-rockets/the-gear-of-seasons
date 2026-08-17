const OmoteHost = process.env['OMOTE_HOST'] || 'hexe.net';

const Config = {
  OmoteHost:  OmoteHost,
  UraHost:    process.env['URA_HOST'] || 'ura.hexe.net',
  dbHostname: process.env['DB_HOST'] || 'postgres',
  // canonical/OGP の絶対URLを組む基準。プレビュー用コンテナなど https でない環境では
  // OMOTE_ORIGIN で上書きする。
  OmoteOrigin: process.env['OMOTE_ORIGIN'] || `https://${OmoteHost}`,
};

export default Config;
