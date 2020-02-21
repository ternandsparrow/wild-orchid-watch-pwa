import { expose as comlinkExpose } from 'comlink'
import Jimp from 'jimp'
import piexif from 'piexifjs'

const defaultJpgQuality = 90 // TODO make env var config

comlinkExpose({
  async resize(blobish, maxWidthOrHeight, quality = defaultJpgQuality) {
    const blobType = blobish.type
    const metadata = await getMetadata(blobish)
    const buffer = await blobish.arrayBuffer()
    const image = await Jimp.read(buffer)
    const metadataWidth = metadata.Exif[piexif.ExifIFD.PixelXDimension]
    const metadataHeight = metadata.Exif[piexif.ExifIFD.PixelYDimension]
    const { resizeWidth, resizeHeight } = (() => {
      const isWiderThanHigh = metadataWidth > metadataHeight
      if (isWiderThanHigh) {
        const newHeight = Math.round(
          metadataHeight / (metadataWidth / maxWidthOrHeight),
        )
        metadata.Exif[piexif.ExifIFD.PixelXDimension] = maxWidthOrHeight
        metadata.Exif[piexif.ExifIFD.PixelYDimension] = newHeight
        return { resizeWidth: maxWidthOrHeight, resizeHeight: Jimp.AUTO }
      }
      const newWidth = Math.round(
        metadataWidth / (metadataHeight / maxWidthOrHeight),
      )
      metadata.Exif[piexif.ExifIFD.PixelXDimension] = newWidth
      metadata.Exif[piexif.ExifIFD.PixelYDimension] = maxWidthOrHeight
      return { resizeWidth: Jimp.AUTO, resizeHeight: maxWidthOrHeight }
    })()
    const resized = await image
      .resize(resizeWidth, resizeHeight)
      .quality(quality)
      .getBufferAsync(Jimp.MIME_JPEG)
    const base64WithMetadata = await writeMetadata(resized, metadata, blobType)
    const resizedBuffer = base64StrToArrayBuffer(base64WithMetadata)
    return new Blob([resizedBuffer], { type: blobType })
  },
})

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
      const result = piexif.load(e.target.result)
      return resolve(result)
    }
    reader.readAsDataURL(imageAsBlob)
  })
}

function writeMetadata(imageAsArrayBuffer, metadataObj, blobType) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = function(e) {
      const exifStr = piexif.dump(metadataObj)
      const inserted = piexif.insert(exifStr, e.target.result)
      return resolve(inserted)
    }
    const theBlob = new Blob([imageAsArrayBuffer], { type: blobType })
    reader.readAsDataURL(theBlob)
  })
}
