const path = require('path')
const DumpVueEnvVarsWebpackPlugin = require('./DumpVueEnvVarsWebpackPlugin.js')
const FaviconsWebpackPlugin = require('favicons-webpack-plugin')

module.exports = {
  /* See https://github.com/vuejs/vue-cli/tree/dev/packages/%40vue/cli-plugin-pwa for more details */
  pwa: {
    themeColor: '#5683BA',
    appleMobileWebAppStatusBarStyle: 'black',
    workboxPluginMode: 'InjectManifest',
    workboxOptions: {
      swSrc: path.join('public', 'service-worker.js'),
    },
  },
  configureWebpack: {
    plugins: [
      new DumpVueEnvVarsWebpackPlugin({ filename: 'wow-env-vars.js' }),
      new FaviconsWebpackPlugin({
        logo: './src/assets/icon-seed-white.png',
        inject: false, // it adds its own manifest.json that clobbers ours
        prefix: 'img/icons/',
        // note: we generate all the icons and inject them into index.html so
        // they can be used for non-PWA purposes
      }),
    ],
  },
}
