const path = require('path')
const fs = require('fs')

const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const SentryWebpackPlugin = require('@sentry/webpack-plugin')
const FaviconsWebpackPlugin = require('favicons-webpack-plugin')

const isDev = process.env.NODE_ENV === 'development'
const isProd = process.env.NODE_ENV === 'production'

module.exports = {
  ...getDevOnlyRootConfig(),
  ...getProdOnlyRootConfig(),
  runtimeCompiler: true, // we need this for Onsen lazy-load
  configureWebpack: config => {
    config.plugins = config.plugins.concat([
      getDumpVueEnvVarsWebpackPlugin(),
      // FIXME do we still need this? And get it working if we do.
      // getKillVueCliManifestPlugin(),
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
          appDescription: 'Wild Orchid Watch; an app for Australian citizen ' +
            'scientists to use for field data collection',
          appleStatusBarStyle: 'default',
          developerName: null,
          developerURL: null,
          start_url: '/index.html',
        },
      }),
    ])
    if (isDev) {
      config.devServer = computeDevServerOptions()
    }
    if (isProd) {
      configureEslint(config)
      configureBundleAnalyzer(config)
      configureSentry(config)
    }
  },
  ...getWebpackChain(),
}

function getWebpackChain() {
  const isDisableMinify = !!process.env.DISABLE_MINIFY
  if (isDisableMinify) {
    console.log('Disabling minification')
    return {
      // thanks https://github.com/vuejs/vue-cli/issues/4328#issuecomment-514250189
      chainWebpack: (config) => config.optimization.minimize(false),
    }
  }
  return {}
}

function getDevOnlyRootConfig() {
  if (!isDev) {
    return {}
  }
  return {
    // we want the noop service worker that the vue pwa plugin provides so our
    // code doesn't explode due to a lack of one. Weirdly, this still works when
    // you do `NODE_ENV=production yarn serve`, but that's good as it's exactly
    // what we want.
    pwa: {
      /* See https://github.com/vuejs/vue-cli/tree/dev/packages/%40vue/cli-plugin-pwa for more details */
      workboxPluginMode: 'GenerateSW',
    },
  }
}

function getProdOnlyRootConfig() {
  if (process.env.NODE_ENV !== 'production') {
    return {}
  }
  return {
    productionSourceMap: process.env.IS_ENABLE_SOURCEMAPS !== 'false',
  }
}

function configureEslint(config) {
  if (process.env.IS_ENABLE_ESLINT !== 'false') {
    // enabled by default
    return
  }
  console.log('[INFO] disabling eslint due to IS_ENABLE_ESLINT')
  const i = config.plugins.findIndex(e => e.key === 'ESLintWebpackPlugin')
  config.plugins.splice(i, 1)
}

function configureBundleAnalyzer(config) {
  if (process.env.IS_ENABLE_BUNDLE_ANALYZER === 'false') {
    return
  }
  console.log('[INFO] enabling bundle analyzer due to IS_ENABLE_BUNDLE_ANALYZER')
  config.plugins.push(
    /* Refer to https://www.npmjs.com/package/webpack-bundle-analyzer for more details */
    new BundleAnalyzerPlugin({
      analyzerMode: 'disabled',
      generateStatsFile: true,
    })
  )
}

function configureSentry(config) {
  if (process.env.DO_SENTRY_RELEASE !== 'true') {
    console.log(
      '[INFO] sentry-webpack-plugin disabled because DO_SENTRY_RELEASE != true',
    )
    return
  }
  const appVersion = process.env.VUE_APP_VERSION
  if (!appVersion) {
    throw new Error(
      'Cannot do Sentry.io release if VUE_APP_VERSION is not defined',
    )
  }
  config.plugin.push(
    new SentryWebpackPlugin({
      release: appVersion,
      include: './dist',
      ignoreFile: '.sentrycliignore',
      ignore: ['node_modules'],
    })
  )
}

function computeDevServerOptions() {
  /**
   * For when you're running behind a proxy, like nginx, then we need to
   * know the host of that proxy so we can respond to it. If we don't set
   * these values then you'll see "Invalid Host header" in the browser.
   *
   * Note: when you specify the PROXY_HOST, that is the *only* way you
   * can access it. Using another host (like localhost) will have the
   * HMR connection fail.
   *
   * Note2: when specifying PROXY_HOST, the --public param to `vue serve`
   * doesn't seem to work any more.
   */
  // FIXME can we just get nginx to set the host header to 'localhost'?
  const proxyHost = process.env.PROXY_HOST
  if (!proxyHost) {
    return {}
  }
  console.log(`[INFO] using proxy host='${proxyHost}'`)
  return {
    allowedHosts: [proxyHost],
    public: `https://${proxyHost}`,
  }
}

function getDumpVueEnvVarsWebpackPlugin() {
  /**
   * We need to configure the service-worker to cache calls to both the API and
   * the iNat server but these are configurable URLs. We already use the env
   * var system that vue-cli offers so implementing something outside the build
   * process that parses the service-worker file would be messy. This lets us
   * dump the env vars as configured for the rest of the app and import them
   * into the service-worker script to use them.
   *
   * We need to use this plugin as the service-worker script is NOT processed
   * by webpack so we can't put any placeholders in it directly.
   */
  return {
    apply(compiler) {
      if (
        process.env.NODE_ENV === 'development' &&
        !process.env.FORCE_ENV_VAR_DUMP
      ) {
        return
      }
      const fileContent = Object.keys(process.env)
        .filter((k) => k.startsWith('VUE_APP_'))
        .reduce((accum, currKey) => {
          const val = process.env[currKey]
          return `${accum}export const ${currKey} = '${val}'\n`
        }, '')
      const outputDir = compiler.options.output.path
      if (!fs.existsSync(outputDir)) {
        // TODO ideally we'd let Webpack create it for us, but not sure how to
        // make this run later in the lifecycle
        fs.mkdirSync(outputDir)
      }
      const fullOutputPath = path.join(outputDir, 'wow-env-vars.js')
      console.debug(
        `[DumpVueEnvVarsWebpackPlugin] dumping env vars to file=${fullOutputPath}`,
      )
      fs.writeFileSync(fullOutputPath, fileContent)
    }
  }
}

function getKillVueCliManifestPlugin() {
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
  return {
    apply(compiler) {
      compiler.hooks.compilation.tap(ID, (compilation) => {
        compilation.hooks.htmlWebpackPluginAlterAssetTags.tapAsync(
          ID,
          (data, cb) => {
            data.head = data.head.filter((e) => e.attributes.rel !== 'manifest')
            cb(null, data)
          },
        )
      })
    }
  }
}
