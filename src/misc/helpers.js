const commonHeaders = {
  Accept: 'application/json',
}

const jsonHeaders = {
  'Content-Type': 'application/json',
  ...commonHeaders,
}

export function wowErrorHandler(msg, err) {
  console.error(msg, err)
  // FIXME notify Rollbar
  // FIXME show something to user to indicate failure
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

function handleResp(resp) {
  const result = resp.json()
  if (resp.ok) {
    return result
  }
  return result.then(body => {
    return Promise.reject({
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers,
      url: resp.url,
      body,
    })
  })
}

export function chainedError(msg, err) {
  err.message = `${msg}\nCaused by: ${err.message}`
  return err
}
