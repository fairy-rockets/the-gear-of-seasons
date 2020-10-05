import * as webpack from 'webpack'
import WriteFilePlugin from 'write-file-webpack-plugin'
import path from 'path'

const config: webpack.Configuration = {
  context: __dirname,
  entry: {
    'main': path.join(__dirname, '/web/omote/main.ts'),
    'admin-editor': path.join(__dirname, '/web/ura/admin-editor.ts'),
  },
  mode: 'development',
  output: {
    path: path.join(__dirname, '_resources/static'),
    filename: '[name].js',
    publicPath: '/static/'
  },
  plugins: [
    new WriteFilePlugin(),
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