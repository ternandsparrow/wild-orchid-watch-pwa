// thanks https://gist.github.com/hanayashiki/8dac237671343e7f0b15de617b0051bd
;(function() {
  // This is a simple trick to implement Blob.arrayBuffer (https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer) using FileReader
  if ('File' in self) {
    File.prototype.arrayBuffer = File.prototype.arrayBuffer || myArrayBuffer
  }
  Blob.prototype.arrayBuffer = Blob.prototype.arrayBuffer || myArrayBuffer

  function myArrayBuffer() {
    // this: File or Blob
    return new Promise(resolve => {
      const fr = new FileReader()
      fr.onload = () => {
        resolve(fr.result)
      }
      fr.readAsArrayBuffer(this)
    })
  }
})()
