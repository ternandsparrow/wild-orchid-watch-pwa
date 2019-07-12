const commonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
}

export function postJson(url, data = {}) {
  return fetch(url, {
    method: 'POST',
    mode: 'cors',
    headers: {
      ...commonHeaders,
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
