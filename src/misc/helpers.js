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
  // FIXME notify Rollbar
}

export function postJson(url, data = {}) {
  const authHeaderValue = null
  return postJsonWithAuth(url, data, authHeaderValue)
}

export function postJsonWithAuth(url, data = {}, authHeaderValue) {
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

function isRespJson(resp) {
  const mimeStr = resp.headers.get('Content-Type') || ''
  return /application\/(\w+(\.\w+)*\+)?json/.test(mimeStr)
}

export function chainedError(msg, err) {
  err.message = `${msg}\nCaused by: ${err.message}`
  return err
}

export const _testonly = {
  isRespJson,
}
