const commonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
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
      ...commonHeaders,
      Authorization: authHeaderValue,
    },
    body: JSON.stringify(data),
  }).then(resp => {
    if (!resp.ok) {
      return handleErrorResp(resp)
    }
    return resp.json()
  })
}

export function getJsonWithAuth(url, authHeaderValue) {
  return fetch(url, {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store', // TODO is this correct? Can we assume that SW will cache for us so if we're making a request, we want it fresh?
    headers: {
      ...commonHeaders,
      Authorization: authHeaderValue,
    },
  }).then(resp => {
    if (!resp.ok) {
      return handleErrorResp(resp)
    }
    return resp.json()
  })
}

function handleErrorResp(resp) {
  return resp.json().then(body => {
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
