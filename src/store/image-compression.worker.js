import { expose as comlinkExpose } from 'comlink'
import Jimp from 'jimp'
import piexif from 'piexifjs'
import '@/misc/safari-blob-patch'

const defaultJpgQuality = 90 // TODO make env var config

comlinkExpose({
  async resize(blobish, maxWidthOrHeight, quality = defaultJpgQuality) {
    const originalImageSizeMb = blobish.size / 1024 / 1024
    const blobType = blobish.type
    const metadata = await getMetadata(blobish)
    const buffer = await blobish.arrayBuffer()
    const image = await Jimp.read(buffer)
    const metadataWidth = image.bitmap.width
    const metadataHeight = image.bitmap.height
    const { resizeWidth, resizeHeight } = (() => {
      const isWiderThanHigh = metadataWidth > metadataHeight
      if (isWiderThanHigh) {
        const newHeight = Math.round(
          metadataHeight / (metadataWidth / maxWidthOrHeight),
        )
        return { resizeWidth: maxWidthOrHeight, resizeHeight: newHeight }
      }
      const newWidth = Math.round(
        metadataWidth / (metadataHeight / maxWidthOrHeight),
      )
      return { resizeWidth: newWidth, resizeHeight: maxWidthOrHeight }
    })()
    const resized = await image
      .resize(resizeWidth, resizeHeight)
      .quality(quality)
    updateMetadataToMatchNewSize(metadata, resized)
    const resizedBuffer = await resized.getBufferAsync(Jimp.MIME_JPEG)
    const base64WithMetadata = await writeMetadata(
      resizedBuffer,
      metadata,
      blobType,
    )
    const resizedBufferWithMetadata = base64StrToArrayBuffer(base64WithMetadata)
    const result = new Blob([resizedBufferWithMetadata], { type: blobType })
    const newSizeMb = result.size / 1024 / 1024
    console.debug(
      `Compressed/resized ${metadataWidth}x${metadataHeight} ` +
        `${originalImageSizeMb.toFixed(3)}MB file ` +
        `to ${resizeWidth}x${resizeHeight} ${newSizeMb.toFixed(3)}MB (` +
        ((newSizeMb / originalImageSizeMb) * 100).toFixed(1) +
        `% of original)`,
    )
    return result
  },
})

function updateMetadataToMatchNewSize(metadata, resized) {
  const width = resized.bitmap.width
  const height = resized.bitmap.height
  if (metadata['0th']) {
    metadata['0th'][piexif.ImageIFD.ImageWidth] = width
    metadata['0th'][piexif.ImageIFD.ImageLength] = height
  }
  if (metadata.Exif) {
    metadata.Exif[piexif.ExifIFD.PixelXDimension] = width
    metadata.Exif[piexif.ExifIFD.PixelYDimension] = height
  }
}

function base64StrToArrayBuffer(base64Str) {
  const withoutBase64Prefix = base64Str.replace('data:image/jpeg;base64,', '')
  // thanks for the conversion https://stackoverflow.com/a/16245768/1410035
  const byteCharacters = atob(withoutBase64Prefix)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return byteArray
}

function getMetadata(imageAsBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = function(e) {
      try {
        const result = piexif.load(e.target.result)
        return resolve(result)
      } catch (err) {
        return reject(err)
      }
    }
    reader.readAsDataURL(imageAsBlob)
  })
}

function writeMetadata(imageAsArrayBuffer, metadataObj, blobType) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = function(e) {
      try {
        const exifStr = piexif.dump(metadataObj)
        const inserted = piexif.insert(exifStr, e.target.result)
        return resolve(inserted)
      } catch (err) {
        return reject(err)
      }
    }
    const theBlob = new Blob([imageAsArrayBuffer], { type: blobType })
    reader.readAsDataURL(theBlob)
  })
}
