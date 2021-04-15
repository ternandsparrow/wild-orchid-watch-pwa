export async function platformTestReqFile() {
  let usedPolyfill = false
  try {
    const fd = new FormData()
    fd.append('observation_photo[observation_id]', 1234)
    const theFile = new File([getTestImage()], 'wow-flower', {
      type: 'image/png',
    })
    fd.append('file', theFile)
    const ab = await new Request('https://localhost', {
      method: 'POST',
      mode: 'cors',
      body: (() => {
        if (fd._blob) {
          usedPolyfill = true
          return fd._blob()
        }
        return fd
      })(),
    }).arrayBuffer()
    return `success, length=${ab.byteLength}, usedPolyfill=${usedPolyfill}`
  } catch (err) {
    return {
      usedPolyfill,
      error: {
        message: err.message,
        name: err.name,
        obj: err,
      },
    }
  }
}

// Same as above (the File version) but using a Blob
export async function platformTestReqBlob() {
  let usedPolyfill = false
  try {
    const fd = new FormData()
    fd.append('observation_photo[observation_id]', 1234)
    const theBlob = new Blob([getTestImage()], { type: 'image/png' })
    fd.append('file', theBlob)
    const ab = await new Request('https://localhost', {
      method: 'POST',
      mode: 'cors',
      body: (() => {
        if (fd._blob) {
          usedPolyfill = true
          return fd._blob()
        }
        return fd
      })(),
    }).arrayBuffer()
    return `success, length=${ab.byteLength}, usedPolyfill=${usedPolyfill}`
  } catch (err) {
    return {
      usedPolyfill,
      error: {
        message: err.message,
        name: err.name,
        obj: err,
      },
    }
  }
}

function getTestImage() {
  // thanks https://png-pixel.com/
  const arrayJsonString = `[
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13,
    73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1,
    8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0,
    13, 73, 68, 65, 84, 120, 218, 99, 100, 248, 255, 191,
    30, 0, 5, 132, 2, 127, 194, 91, 30, 42, 0, 0,
    0, 0, 73, 69, 78, 68, 174, 66, 96, 130
  ]`
  return new Uint8Array(JSON.parse(arrayJsonString))
}
