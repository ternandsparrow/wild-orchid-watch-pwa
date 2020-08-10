// helpers that have have no dependencies. There should be *no import*
// statements in this module!

export function base64StrToArrayBuffer(base64Str) {
  // thanks for the conversion https://stackoverflow.com/a/16245768/1410035
  const byteCharacters = atob(base64Str)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return byteArray
}

export function arrayBufferToBase64(buffer) {
  // thanks https://stackoverflow.com/a/9458996/1410035
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

export async function encryptAndBase64Encode(
  publicKeyJwkString,
  plainText,
  cryptoConfig,
) {
  const publicAsymKey = await getPublicAsymKey()

  const symmetricKey = await generateSymKey()
  const { payloadCipherText, iv } = await encryptPayload(
    plainText,
    symmetricKey,
  )
  const symKeyBundleCipherText = await encryptSymKeyBundle(
    symmetricKey,
    iv,
    publicAsymKey,
  )
  const safeToTransport = {
    payload: payloadCipherText,
    symKeyBundle: symKeyBundleCipherText,
  }
  return safeToTransport

  function generateSymKey() {
    return window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt'],
    )
  }

  async function encryptPayload(plainText, symKey) {
    const encodedMsg = new TextEncoder().encode(plainText)
    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      symKey,
      encodedMsg,
    )
    return {
      payloadCipherText: arrayBufferToBase64(encrypted),
      iv,
    }
  }

  async function encryptSymKeyBundle(symKey, iv, pubKey) {
    const exportedSymKey = await window.crypto.subtle.exportKey('raw', symKey)
    const base64ExportedSymKey = arrayBufferToBase64(exportedSymKey)
    const base64Iv = arrayBufferToBase64(iv)
    const encodedMsg = new TextEncoder().encode(
      JSON.stringify({ symKey: base64ExportedSymKey, iv: base64Iv }),
    )
    console.debug('Size of sym key bundle message', encodedMsg.byteLength)
    if (encodedMsg.byteLength > 190) {
      console.warn(
        'sym key bundle is too large, the encrypt is probably about to fail',
      )
    }
    const encrypted = await window.crypto.subtle.encrypt(
      // I chose this over wrapKey because I can include the IV
      {
        name: 'RSA-OAEP',
      },
      pubKey,
      encodedMsg,
    )
    return arrayBufferToBase64(encrypted)
  }

  function getPublicAsymKey() {
    const parsedKey = JSON.parse(publicKeyJwkString)
    return window.crypto.subtle.importKey(
      'jwk',
      parsedKey,
      cryptoConfig.rsaParams,
      true,
      ['encrypt'],
    )
  }
}

export async function base64DecodeAndDecrypt(
  privateKeyJwkString,
  dataObjStr,
  cryptoConfig,
) {
  const parsedKey = JSON.parse(privateKeyJwkString)
  const privateKey = await window.crypto.subtle.importKey(
    'jwk',
    parsedKey,
    cryptoConfig.rsaParams,
    true,
    ['decrypt'],
  )
  const dataObj = JSON.parse(dataObjStr)

  const decryptedSymmetricKeyBundle = await decryptSymKeyBundle(
    dataObj.symKeyBundle,
    privateKey,
  )
  console.debug('Decrypting payload')
  return decryptPayload(dataObj.payload, decryptedSymmetricKeyBundle)

  async function decryptSymKeyBundle(symKeyBundleCipherTextBase64, privateKey) {
    // we base64 encoded the symKeyBundleCipherText for transport
    const symKeyBundleCipherText = base64StrToArrayBuffer(
      symKeyBundleCipherTextBase64,
    )
    const decryptedBundleStr = await window.crypto.subtle.decrypt(
      {
        name: 'RSA-OAEP',
      },
      privateKey,
      symKeyBundleCipherText,
    )
    const bundle = JSON.parse(new TextDecoder().decode(decryptedBundleStr))
    const importedKey = await window.crypto.subtle.importKey(
      'raw',
      base64StrToArrayBuffer(bundle.symKey),
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt'],
    )
    return {
      symKey: importedKey,
      iv: base64StrToArrayBuffer(bundle.iv),
    }
  }

  async function decryptPayload(payload, symKeyBundle) {
    // we base64 encoded the payload for transport
    const parsedEncrypted = base64StrToArrayBuffer(payload)
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: symKeyBundle.iv,
      },
      symKeyBundle.symKey,
      parsedEncrypted,
    )
    const decryptedPlainText = new TextDecoder().decode(decrypted)
    return decryptedPlainText
  }
}
