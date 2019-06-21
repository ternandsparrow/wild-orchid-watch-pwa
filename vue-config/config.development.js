module.exports = {
  configureWebpack: config => {
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
      devServer: {
        allowedHosts: [proxyHost],
        public: `https://${proxyHost}`,
      },
    }
  },
}
