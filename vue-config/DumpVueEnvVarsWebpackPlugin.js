const path = require('path')
const fs = require('fs')

/**
 * We to configure the service-worker to cache calls to both the API and the
 * iNat server but these are configurable URLs. We already use the env var
 * system that vue-cli offers so implementing something outside the build
 * process that parses the service-worker file would be messy. This lets us
 * dump the env vars as configured for the rest of the app and import them into
 * the service-worker script to use them.
 *
 * We need to do this as the service-worker script is NOT processed by webpack
 * so we can't put any placeholders in it directly.
 */

module.exports = class DumpVueEnvVarsWebpackPlugin {
  constructor(opts) {
    this.filename = opts.filename || 'env-vars-dump.js'
  }

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
        accum += `export const ${currKey} = '${val}'\n`
        return accum
      }, '')
    const outputDir = compiler.options.output.path
    if (!fs.existsSync(outputDir)) {
      // TODO ideally we'd let Webpack create it for us, but not sure how to
      // make this run later in the lifecycle
      fs.mkdirSync(outputDir)
    }
    const fullOutputPath = path.join(outputDir, this.filename)
    console.debug(
      `[DumpVueEnvVarsWebpackPlugin] dumping env vars to file=${fullOutputPath}`,
    )
    fs.writeFileSync(fullOutputPath, fileContent)
  }
}
