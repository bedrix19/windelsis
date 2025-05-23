const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';

const jsConfig = {
  entry: [
    './src/vendor/leaflet-velocity.js',
    './src/js/mapManager.js'
  ],
  output: {
    filename: isProduction ? 'windelsis.min.js' : 'windelsis.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'Windelsis',
    libraryTarget: 'umd',
    globalObject: 'this',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader'
      }
    ]
  },
  optimization: {
    minimize: isProduction,
    minimizer: [new TerserPlugin()]
  },
  mode: isProduction ? 'production' : 'development',
  devtool: false
};

const cssConfig = {
  entry: [
    './src/vendor/leaflet-velocity.css',
    './src/css/windelsis.css'
  ],
  output: {
    filename: 'dummy.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: isProduction ? 'windelsis.min.css' : 'windelsis.css'
    })
  ],
  optimization: {
    minimize: isProduction,
    minimizer: [new CssMinimizerPlugin()]
  },
  mode: isProduction ? 'production' : 'development'
};

module.exports = [jsConfig, cssConfig];
