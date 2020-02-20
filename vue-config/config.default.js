const path = require('path')
const FaviconsWebpackPlugin = require('favicons-webpack-plugin')
const WorkerPlugin = require('worker-plugin')
const KillVueCliManifestPlugin = require('./KillVueCliManifestPlugin')
const DumpVueEnvVarsWebpackPlugin = require('./DumpVueEnvVarsWebpackPlugin.js')

module.exports = {
  configureWebpack: {
    plugins: [
      new DumpVueEnvVarsWebpackPlugin({ filename: 'wow-env-vars.js' }),
      new KillVueCliManifestPlugin(),
      new FaviconsWebpackPlugin({
        logo: './src/assets/icon-seed-white.png',
        inject: true,
        devMode: 'webapp',
        prefix: 'img/icons/',
        favicons: {
          theme_color: '#5683BA',
          background: '#000', // background of flattened icons
          appName: 'Wild Orchid Watch',
          appShortName: 'WildOrchidWatch',
          appDescription:
            'Wild Orchid Watch; an app for Australian citizen scientists to use for field data collection',
          appleStatusBarStyle: 'default',
          developerName: null,
          developerURL: null,
          start_url: '/index.html',
        },
      }),
      new WorkerPlugin({
        globalObject: 'self',
      }),
    ],
  },
  ...getWebpackChain(),
}

function getWebpackChain() {
  const isDisableMinify = !!process.env.DISABLE_MINIFY
  if (isDisableMinify) {
    console.log('Disabling minification')
    return {
      // thanks https://github.com/vuejs/vue-cli/issues/4328#issuecomment-514250189
      chainWebpack: config => config.optimization.minimize(false),
    }
  }
  return {}
}
