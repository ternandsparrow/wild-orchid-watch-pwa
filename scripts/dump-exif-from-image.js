#!/usr/bin/env node
// Dumps the EXIF from a given image (so we can use it in unit tests)
const EXIF = require('exif-js')

const fs = require('fs')
const path = require('path')

const inputPath = (() => {
  const rawFilePath = process.argv[2]
  if (!rawFilePath) {
    throw new Error('First param must be path to file to image')
  }
  const isRelative = !rawFilePath.startsWith('/')
  if (isRelative) {
    const pwd = process.env.PWD
    return path.join(pwd, rawFilePath)
  }
  return rawFilePath
})()

log(`[INFO] reading image ${inputPath}`)
async function main() {
  const blob = fs.readFileSync(inputPath)
  const exifData = await getExifFromBlob(blob)
  log('The result:')
  truncateLongValue(exifData, 'MakerNote')
  truncateLongValue(exifData, 'UserComment')
  console.info(JSON.stringify(exifData, null, 2))
}

function truncateLongValue(obj, attrName) {
  const val = obj[attrName]
  if (!val) {
    return
  }
  obj[attrName] = `truncated ${val.length} bytes`
}

// EXIF expects to be in a browser where 'self' is defined
self = global
global.FileReader = function () {
  const self = this
  self.onload = function () {
    throw new Error('Override me!')
  }
  self.readAsArrayBuffer = function (img) {
    self.onload({ target: { result: img.buffer } })
  }
}
global.Blob = Buffer
global.File = Buffer

main()
  .then(() => log('[INFO] done :D'))
  .catch((err) => log('Fail-town', err))

function getExifFromBlob(blobish) {
  return new Promise((resolve, reject) => {
    EXIF.getData(blobish, function () {
      try {
        return resolve(EXIF.getAllTags(this))
      } catch (err) {
        return reject(err)
      }
    })
  })
}

function log(msg) {
  process.stderr.write(`${msg}\n`)
}
