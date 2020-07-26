import * as webpack from "webpack";
import WriteFilePlugin from "write-file-webpack-plugin";

const config: webpack.Configuration = {
  context: __dirname,
  entry: {
    'main': __dirname+'/web/omote/main.ts',
    'admin-editor': __dirname+'/web/ura/admin-editor.js',
  },
  mode: 'development',
  output: {
    path: __dirname + '/_resources/static',
    filename: '[name].js',
    publicPath: '/static/'
  },
  plugins: [
    new WriteFilePlugin(),
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader'
      },
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  }
};

export default config;