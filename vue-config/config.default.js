const path = require('path')
const FaviconsWebpackPlugin = require('favicons-webpack-plugin')
const DumpVueEnvVarsWebpackPlugin = require('./DumpVueEnvVarsWebpackPlugin.js')

/**
 * This is a bit of a mess but it works. Vue-cli has PWA support, which offers
 * two things 1) generation/including the service worker (this is great, we
 * want and use this), and 2) some manifest stuff. I say " manifest stuff"
 * because the README talks about generating a manifest but it doesn't seem to.
 * It *does* inject a link into the index.html head for the manifest though.
 * We're also using the FaviconWebpackPlugin (see lower down) which will
 * generate all our icons from a single seed image and include them all in
 * index.html. It also generates a manifest.json as part of that. So now we
 * have a problem because we have two links to (two different, and one
 * non-existant) manifests. Fear not, this plugin will kill the vue-cli's
 * manifest link. It looks like it kills all manifests (it does) but we're
 * lucky that the favicon plugin runs after this plugin.
 */
const ID = 'KillVueCliManifestPlugin'
class KillVueCliManifestPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap(ID, compilation => {
      compilation.hooks.htmlWebpackPluginAlterAssetTags.tapAsync(
        ID,
        (data, cb) => {
          data.head = data.head.filter(e => e.attributes.rel !== 'manifest')
          cb(null, data)
        },
      )
    })
  }
}

module.exports = {
  /* See https://github.com/vuejs/vue-cli/tree/dev/packages/%40vue/cli-plugin-pwa for more details */
  pwa: {
    workboxPluginMode: 'InjectManifest',
    workboxOptions: {
      swSrc: path.join('public', 'service-worker.js'),
      // We may still need this - TDB
      /* https://github.com/GoogleChrome/workbox/issues/1744 */
      // skipWaiting: true,
    },
  },
  configureWebpack: {
    plugins: [
      new DumpVueEnvVarsWebpackPlugin({ filename: 'wow-env-vars.js' }),
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
      new KillVueCliManifestPlugin(),
    ],
  },
}
