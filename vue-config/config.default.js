const path = require('path')

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
    plugins: [],
  },
  /*
  chainWebpack: config => {
    // HTML Loader
    config.module
      .rule('html')
      .test(/\.(html)$/)
      .use('html-loader')
      .loader('html-loader')
      .end()
  },
  */
}
