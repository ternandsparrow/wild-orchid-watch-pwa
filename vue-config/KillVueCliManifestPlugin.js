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
module.exports = class KillVueCliManifestPlugin {
  // eslint-disable-next-line class-methods-use-this
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
