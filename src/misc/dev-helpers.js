import base64js from 'base64-js'

export async function platformTestReqFile() {
  let usedPolyfill = false
  try {
    const fd = new FormData()
    fd.append('observation_photo[observation_id]', 1234)
    const photoBuffer = base64js.toByteArray(
      // thanks https://png-pixel.com/
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhA' +
        'J/wlseKgAAAABJRU5ErkJggg==',
    )
    const theFile = new File([photoBuffer], 'wow-flower', { type: 'image/png' })
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
    const photoBuffer = base64js.toByteArray(
      // thanks https://png-pixel.com/
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhA' +
        'J/wlseKgAAAABJRU5ErkJggg==',
    )
    const theBlob = new Blob([photoBuffer], { type: 'image/png' })
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
