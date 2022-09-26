import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import sourcesmaps from 'rollup-plugin-sourcemaps'
import alias from '@rollup/plugin-alias'
import injectProcess from './rollup-plugin-inject-process'

export default {
  input: 'sw-src/sw.js',
  output: [
    {
      sourcemap: true,
      file: 'dist/sw-needsinjecting.js',
      format: 'iife',
      name: 'wowSw', // just to silence the warning, you never need to access this
    },
  ],
  plugins: [
    alias({
      entries: [{ find: '@', replacement: `${__dirname}/src` }],
    }),
    nodeResolve({ // lets us find dependencies in node_modules
      jail: __dirname,
      preferBuiltins: false, // we're running in the browser so we can't use builtins (I think)
    }),
    commonjs(),
    injectProcess(['NODE_ENV', /VUE_APP_.*/]),
    sourcesmaps(),
  ],
}
