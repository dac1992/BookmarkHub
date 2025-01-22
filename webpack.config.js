const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: 'source-map',
  entry: {
    'popup/index': './src/popup/index.ts',
    'settings/index': './src/popup/settings.ts',
    'background/index': './src/background/index.ts',
    'debug/index': './src/debug/index.js'
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
              transpileOnly: true,
              compilerOptions: {
                sourceMap: true
              }
            }
          }
        ],
        exclude: /node_modules/
      },
      {
        test: /\.js$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        ],
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader'
        ]
      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name][ext]'
        }
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
      scriptLoading: 'defer'
    }),
    new HtmlWebpackPlugin({
      template: './src/popup/settings.html',
      filename: 'settings/index.html',
      chunks: ['settings/index'],
      inject: 'body',
      scriptLoading: 'defer'
    }),
    new HtmlWebpackPlugin({
      template: './src/debug/index.html',
      filename: 'debug/index.html',
      chunks: ['debug/index'],
      inject: 'body',
      scriptLoading: 'defer'
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css'
    }),
    new CopyWebpackPlugin({
      patterns: [
        { 
          from: 'src/manifest.json',
          transform(content) {
            return Buffer.from(JSON.stringify({
              ...JSON.parse(content.toString()),
              version: process.env.npm_package_version || '1.0.0'
            }, null, 2))
          }
        },
        { 
          from: 'src/assets/*.{png,jpg,gif,svg}',
          to: 'assets/[name][ext]'
        }
      ]
    })
  ],
  optimization: {
    minimize: process.env.NODE_ENV === 'production',
    splitChunks: false
  },
  performance: {
    hints: false
  },
  stats: {
    logging: 'verbose',
    colors: true,
    modules: true,
    reasons: true,
    errorDetails: true
  }
}; 