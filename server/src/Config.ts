const Config = {
  OmoteHost:  process.env['OMOTE_HOST'] || 'hexe.net',
  UraHost:    process.env['URA_HOST'] || 'ura.hexe.net',
  dbHostname: process.env['DB_HOST'] || 'postgres',
};

export default Config;
