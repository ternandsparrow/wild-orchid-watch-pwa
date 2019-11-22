import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import injectProcess from './rollup-plugin-inject-process'

export default {
  input: 'sw-src/sw.js',
  output: [
    {
      file: 'dist/sw-needsinjecting.js',
      format: 'iife',
    },
  ],
  plugins: [
    nodeResolve(), // lets us find dependencies in node_modules
    commonjs(),
    injectProcess(['NODE_ENV', /VUE_APP_.*/]),
  ],
}
