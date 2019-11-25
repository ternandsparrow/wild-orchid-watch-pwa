// Removes process.env.* references that explode browsers
// thanks https://github.com/rollup/rollup/issues/487#issuecomment-486229172
import MagicString from 'magic-string'
import * as extraEnvVars from './dist/wow-env-vars.js' // it would be nice to have this filename as a param but for that we need to do dynamic imports (https://v8.dev/features/dynamic-import#dynamic) and it starts getting a bit crazy, so that's a future job.

export default function injectProcessPlugin(envVarWhitelist) {
  // The virtual id for our shared "process" mock. We prefix it with \0 so that
  // other plugins ignore it
  const INJECT_PROCESS_MODULE_ID = '\0inject-process'

  for (const currKey of Object.keys(extraEnvVars)) {
    process.env[currKey] = extraEnvVars[currKey]
  }

  // only expose the env vars that we whitelist
  const whitelistStrings = envVarWhitelist.filter(e => typeof e === 'string')
  const whitelistRegexps = envVarWhitelist.filter(e => e.constructor === RegExp)
  const env = whitelistStrings.reduce((accum, curr) => {
    const val = process.env[curr]
    accum[curr] = val
    return accum
  }, {})
  whitelistRegexps.forEach(re => {
    const matchingAndNotIncludedYetKeys = Object.keys(process.env).filter(
      k => !Object.keys(env).includes(k) && re.test(k),
    )
    for (const currKey of matchingAndNotIncludedYetKeys) {
      env[currKey] = process.env[currKey]
    }
  })
  console.log(
    `[InjectProcessPlugin] including the following keys from process.env=${JSON.stringify(
      Object.keys(env),
    )}`,
  )

  return {
    name: 'inject-process',
    resolveId(id) {
      // this tells Rollup not to try to resolve imports from our virtual id
      if (id === INJECT_PROCESS_MODULE_ID) {
        return INJECT_PROCESS_MODULE_ID
      }
    },
    load(id) {
      if (id === INJECT_PROCESS_MODULE_ID) {
        // All fields of 'process' we want to mock are top level exports of the module.
        // For now I hardcoded "NODE_ENV" but you probably want to put more logic here.
        return `export const env = ${JSON.stringify(env)};\n`
      }
    },
    transform(code, id) {
      // Each module except our virtual module gets the process mock injected.
      // Tree-shaking will make sure the import is removed from most modules later.
      // This will produce invalid code if a module defines a top-level "process" variable, so beware!
      if (id !== INJECT_PROCESS_MODULE_ID) {
        const magicString = new MagicString(code)
        magicString.prepend(
          `import * as process from '${INJECT_PROCESS_MODULE_ID}';\n`,
        )
        return {
          code: magicString.toString(),
          map: magicString.generateMap({ hires: true }),
        }
      }
    },
  }
}
