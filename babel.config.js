const isTest = process.env.NODE_ENV === 'test'

module.exports = {
  presets: ['@vue/cli-plugin-babel/preset'],
  plugins: [
    // thanks https://stackoverflow.com/a/70640363/1410035
    ...(isTest ? ['babel-plugin-transform-import-meta'] : []),
  ]
}
