import * as Sentry from '@sentry/browser' // piggybacks on the config done in src/main.js

const commonHeaders = {
  Accept: 'application/json',
}

const jsonHeaders = {
  'Content-Type': 'application/json',
  ...commonHeaders,
}

// Prefer to dispatch('flagGlobalError') as that will inform the UI and call
// this eventually
export function wowErrorHandler(msg, err) {
  console.error(msg, err)
  const processedError = chainedError(msg, err)
  Sentry.captureException(processedError)
}

export function wowWarnHandler(msg, err) {
  console.warn(msg, err)
  Sentry.withScope(scope => {
    scope.setLevel('warning')
    Sentry.captureException(chainedError(msg, err))
  })
}

export function postJson(url, data = {}) {
  const authHeaderValue = null
  return postJsonWithAuth(url, data, authHeaderValue)
}

export function postJsonWithAuth(url, data = {}, authHeaderValue) {
  // TODO consider using https://github.com/sindresorhus/ky instead of fetch()
  return fetch(url, {
    method: 'POST',
    mode: 'cors',
    headers: {
      ...jsonHeaders,
      Authorization: authHeaderValue,
    },
    body: JSON.stringify(data),
  }).then(handleResp)
}

export function postFormDataWithAuth(
  url,
  populateFormDataCallback,
  authHeaderValue,
) {
  const formData = new FormData()
  populateFormDataCallback(formData)
  return fetch(url, {
    method: 'POST',
    mode: 'cors',
    headers: {
      ...commonHeaders,
      Authorization: authHeaderValue,
    },
    body: formData,
  }).then(handleResp)
}

export function getJsonWithAuth(url, authHeaderValue) {
  return fetch(url, {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store', // TODO is this correct? Can we assume that SW will cache for us so if we're making a request, we want it fresh?
    headers: {
      ...jsonHeaders,
      Authorization: authHeaderValue,
    },
  }).then(handleResp)
}

export function deleteWithAuth(url, authHeaderValue) {
  return fetch(url, {
    method: 'DELETE',
    mode: 'cors',
    cache: 'no-store',
    headers: {
      ...jsonHeaders,
      Authorization: authHeaderValue,
    },
  }).then(handleResp)
}

async function handleResp(resp) {
  const isJson = isRespJson(resp)
  const isRespOk = resp.ok
  try {
    if (isRespOk && isJson) {
      return resp.json()
    }
  } catch (err) {
    throw chainedError('Failed while parsing JSON response', err)
  }
  const bodyAccessor = isJson ? 'json' : 'text'
  const bodyPromise = resp.bodyUsed
    ? Promise.resolve('(body already used)')
    : resp[bodyAccessor]()
  return bodyPromise.then(body => {
    return Promise.reject({
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers,
      url: resp.url,
      body,
      msg: `Resp ok=${isRespOk}, Resp is JSON=${isJson}`,
    })
  })
}

/**
 * Assert that the record matches our schema.
 *
 * Using a verifier seems more maintainable than a mapper function. A mapper
 * would have a growing list of either unnamed params or named params which
 * would already be the result object. A verifier lets your freehand map the
 * object but it still shows linkage between all the locations we do mapping
 * (hopefully not many).
 */
export function verifyWowDomainPhoto(photo) {
  let msg = ''
  assertFieldPresent('id')
  assertFieldPresent('url')
  assertFieldPresent('licenseCode')
  assertFieldPresent('attribution')
  if (msg) {
    throw new Error(msg)
  }
  return
  function assertFieldPresent(fieldName) {
    photo[fieldName] || (msg += `'${fieldName}' is missing. `)
  }
}

function isRespJson(resp) {
  const mimeStr = resp.headers.get('Content-Type') || ''
  return /application\/(\w+(\.\w+)*\+)?json/.test(mimeStr)
}

export function chainedError(msg, err) {
  if (!err) {
    return new Error(
      `${msg}\nError while handling error: chainedError` +
        ` was called without an error to chain`,
    )
  }
  err.message = `${msg}\nCaused by: ${err.message}`
  return err
}

export function now() {
  return new Date().getTime()
}

export const _testonly = {
  isRespJson,
  verifyWowDomainPhoto,
}
