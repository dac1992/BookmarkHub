const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  mode: 'development',
  entry: {
    'background/index': './src/background/index.ts',
    'popup/index': './src/popup/index.ts',
    'popup/history': './src/popup/history.ts',
    'popup/error-details': './src/popup/error-details.ts'
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
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { 
          from: 'src/manifest.json',
          to: 'manifest.json'
        },
        {
          from: 'src/assets',
          to: 'assets',
          globOptions: {
            ignore: ['**/*.ts']
          }
        }
      ]
    }),
    new HtmlWebpackPlugin({
      template: 'src/popup/index.html',
      filename: 'popup/index.html',
      chunks: ['popup/index']
    }),
    new HtmlWebpackPlugin({
      template: 'src/popup/history.html',
      filename: 'popup/history.html',
      chunks: ['popup/history']
    }),
    new HtmlWebpackPlugin({
      template: 'src/popup/error-details.html',
      filename: 'popup/error-details.html',
      chunks: ['popup/error-details']
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css'
    })
  ]
}; 