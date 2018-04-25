const path = require('path');
const WriteFilePlugin = require('write-file-webpack-plugin');

module.exports = {
  context: __dirname,
  entry: {
    'index': __dirname+'/frontend/index.js',
  },
  mode: "development",
  output: {
    path: __dirname + '/_resources/static',
    filename: '[name].js',
    publicPath: '/static/'
  },
  plugins: [
    new WriteFilePlugin(),
  ],
  module: {
    rules: [{
      test: /\.js$/,
      use: [{
          loader: 'babel-loader',
          options: {
            presets: [
              // {modules: false}にしないと import 文が Babel によって CommonJS に変換され、
              // webpack の Tree Shaking 機能が使えない
                ['env', {'modules': false}]
            ]
          }
        }]
    }]
  }

};