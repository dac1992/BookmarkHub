const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: {
    'popup/index': './src/popup/index.ts',
    'settings/index': './src/popup/settings.ts',
    'background/index': './src/background/index.ts',
    'debug/index': './src/debug/index.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: false,
              compilerOptions: {
                sourceMap: true
              }
            }
          }
        ],
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              publicPath: '../'
            }
          },
          'css-loader'
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/popup/index.html',
      filename: 'popup/index.html',
      chunks: ['popup/index'],
      inject: 'body',
      scriptLoading: 'defer',
      minify: false
    }),
    new HtmlWebpackPlugin({
      template: './src/popup/settings.html',
      filename: 'settings/index.html',
      chunks: ['settings/index'],
      inject: 'body',
      scriptLoading: 'defer',
      minify: false
    }),
    new HtmlWebpackPlugin({
      template: './src/debug/index.html',
      filename: 'debug/index.html',
      chunks: ['debug/index'],
      inject: 'body',
      scriptLoading: 'defer',
      minify: false
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css'
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/manifest.json' },
        { from: 'src/assets', to: 'assets' }
      ]
    })
  ],
  optimization: {
    minimize: false,
    splitChunks: false
  }
}; 