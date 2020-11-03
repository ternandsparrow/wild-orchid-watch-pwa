import fs from 'fs'

export function getPhotoWithThumbnail() {
  return _loadBlob('/./photo-with-exif-thumbnail.jpg')
}

export function getPhotoNoThumbnail() {
  return _loadBlob('/./photo-with-exif-no-thumbnail.jpg')
}

export function getPhotoNoExif() {
  return _loadBlob('/./photo-without-exif.jpg')
}

export const sizeOfPhotoWithExifThumbnail = 16165
export const sizeOfPhotoWithExifNoThumbnail = 7583
export const sizeOfPhotoNoExif = 1398
export const byteLengthOfThumbnail = 8474

export function _loadBlob(pathSuffix) {
  const data = fs.readFileSync(__dirname + pathSuffix)
  return new Blob([data], { type: 'image/jpeg' })
}
