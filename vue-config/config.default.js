// eslint-disable-next-line import/no-extraneous-dependencies
const FaviconsWebpackPlugin = require('favicons-webpack-plugin')
const WorkerPlugin = require('worker-plugin')
const KillVueCliManifestPlugin = require('./KillVueCliManifestPlugin')
const DumpVueEnvVarsWebpackPlugin = require('./DumpVueEnvVarsWebpackPlugin.js')

module.exports = {
  runtimeCompiler: true, // we need this for Onsen lazy-load
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
  transpileDependencies: [
    // FIXME there may be some caching stuff going on here. Suddenly I couldn't
    // rebuild the dev server when I stopped and tried again immediately.
    // Adding transpileDependencies didn't help until I cleared the cache:
    //   rm -fr node_modules/.cache/
    'gmap-vue',
  ]
}

function getWebpackChain() {
  const isDisableMinify = !!process.env.DISABLE_MINIFY
  if (isDisableMinify) {
    // FIXME disabling minification causes build errors like
    //     Module parse failed: Unexpected token (142:15)
    //   ...on lines containing the ?. property accessor syntax. Currently it
    //   seems to only affect code from gmap-vue.
    console.log('Disabling minification')
    return {
      // thanks https://github.com/vuejs/vue-cli/issues/4328#issuecomment-514250189
      chainWebpack: config => config.optimization.minimize(false),
    }
  }
  return {}
}
