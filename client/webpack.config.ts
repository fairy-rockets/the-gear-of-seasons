import * as webpack from 'webpack'
import WriteFilePlugin from 'write-file-webpack-plugin'
import path from 'path'

const config: webpack.Configuration = {
  context: __dirname,
  entry: {
    'main': path.join(__dirname, '/src/omote/main.ts'),
    'admin-editor': path.join(__dirname, '/src/ura/admin-editor.ts'),
  },
  mode: 'development',
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
    publicPath: '/dist/'
  },
  plugins: [
  ],
  module: {
    rules: [{
      test: /\.ts$/,
      use: 'ts-loader'
    }]
  },
  resolve: {
    extensions: [
      '.ts',
      '.js'
    ]
  },
};

export default config;
