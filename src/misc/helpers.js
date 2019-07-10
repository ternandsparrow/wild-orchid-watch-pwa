export function postJson(url, data = {}) {
  return fetch(url, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json',
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
      'Content-Type': 'application/json',
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
