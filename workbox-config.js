module.exports = {
  swSrc: 'dist/sw-needsinjecting.js',
  swDest: 'dist/service-worker.js',
  globDirectory: 'dist/',
  globPatterns: [
    '**/*.{css,woff,woff2,ttf,eot,svg,jpg,png,xml,ico,json,webapp,html,js,txt,thmx}',
  ],
  globIgnores: ['sw*', 'stats.json', 'service-worker.js'],
}
