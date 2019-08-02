const BundleAnalyzerPlugin = require('webpack-bundle-analyzer') // eslint-disable-line
  .BundleAnalyzerPlugin
const SentryWebpackPlugin = require('@sentry/webpack-plugin')

module.exports = {
  configureWebpack: {
    plugins: [
      /* Refer to https://www.npmjs.com/package/webpack-bundle-analyzer for more details */
      new BundleAnalyzerPlugin({
        analyzerMode: 'disabled',
        generateStatsFile: true,
      }),
      ...getConditionalPlugins(),
    ],
  },
}

function getConditionalPlugins() {
  if (process.env.DO_SENTRY_RELEASE !== 'true') {
    console.log(
      '[INFO] sentry-webpack-plugin disabled because DO_SENTRY_RELEASE != true',
    )
    return []
  }
  const appVersion = process.env.VUE_APP_VERSION || die()
  return [
    new SentryWebpackPlugin({
      release: appVersion,
      include: './dist',
      ignoreFile: '.sentrycliignore',
      ignore: ['node_modules'],
    }),
  ]
}

function die() {
  throw new Error(
    'Cannot do Sentry.io release if VUE_APP_VERSION is not defined',
  )
}
