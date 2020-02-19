import * as Sentry from '@sentry/browser' // piggybacks on the config done in src/main.js
import moment from 'moment'
import { isNil } from 'lodash'
import EXIF from 'exif-js'
import * as constants from '@/misc/constants'
import { chainedError, now } from './no-deps-helpers'

export { chainedError, now }

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
  console.error(msg, err || '(no error object passed)')
  const processedError = chainedError(msg, err)
  Sentry.withScope(function(scope) {
    if (err && err.httpStatus) {
      scope.setTag('http-status', err.httpStatus)
    }
    Sentry.captureException(processedError)
  })
}

export function wowWarnHandler(msg, err) {
  console.warn(msg, err || '(no error object passed)')
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
  return doManagedFetch(url, {
    method: 'POST',
    mode: 'cors',
    headers: {
      ...jsonHeaders,
      Authorization: authHeaderValue,
    },
    body: JSON.stringify(data),
  })
}

export function putJsonWithAuth(url, data = {}, authHeaderValue) {
  return doManagedFetch(url, {
    method: 'PUT',
    mode: 'cors',
    headers: {
      ...jsonHeaders,
      Authorization: authHeaderValue,
    },
    body: JSON.stringify(data),
  })
}

export function postFormDataWithAuth(
  url,
  populateFormDataCallback,
  authHeaderValue,
) {
  const formData = new FormData()
  populateFormDataCallback(formData)
  return doManagedFetch(url, {
    method: 'POST',
    mode: 'cors',
    headers: {
      ...commonHeaders,
      Authorization: authHeaderValue,
    },
    body: formData,
  })
}

export function getJson(url) {
  const authHeader = null
  return getJsonWithAuth(url, authHeader)
}

export function getJsonWithAuth(url, authHeaderValue) {
  // supplying cache: 'no-store' to fetch() works perfectly except for iOS
  // Safari which explodes, so we have to fall back to this dirty way of cache
  // busting
  const isQueryStringPresent = url.includes('?')
  const cacheBustSeparator = isQueryStringPresent ? '&' : '?'
  const urlWithCacheBust = `${url}${cacheBustSeparator}cache-bust=${now()}`
  return doManagedFetch(urlWithCacheBust, {
    method: 'GET',
    mode: 'cors',
    headers: {
      ...jsonHeaders,
      Authorization: authHeaderValue,
    },
  })
}

export async function isNoSwActive() {
  const result = !(await isSwActive())
  return result
}

export async function isSwActive() {
  try {
    const resp = await fetch(constants.serviceWorkerIsAliveMagicUrl, {
      method: 'GET',
      retries: 0,
    })
    return resp.ok // if we get a response, it should be ok
  } catch (err) {
    return false
  }
}

function isObsWithLocalProcessor(record) {
  return (
    (record.wowMeta || {})[constants.recordProcessingOutcomeFieldName] ===
    constants.withLocalProcessorOutcome
  )
}

export function isPossiblyStuck($store, record) {
  const isAllowedToSync = !$store.getters.isSyncDisabled
  const isProcessorRunning = $store.getters['ephemeral/isLocalProcessorRunning']
  return (
    isAllowedToSync && isObsWithLocalProcessor(record) && !isProcessorRunning
  )
}

export function deleteWithAuth(url, authHeaderValue, wowUuid) {
  const alsoOkHttpStatuses = [404]
  const extraHeaders = {}
  if (wowUuid) {
    // when running without a SW, this header will go to the iNat server, which
    // should ignore it. If our SW *is* running, it needs this value.
    extraHeaders[constants.wowUuidCustomHttpHeader] = wowUuid
  }
  return doManagedFetch(
    url,
    {
      method: 'DELETE',
      mode: 'cors',
      headers: {
        ...jsonHeaders,
        Authorization: authHeaderValue,
        ...extraHeaders,
      },
    },
    alsoOkHttpStatuses,
  )
}

async function doManagedFetch(url, req, alsoOkHttpStatuses) {
  try {
    const resp = await fetch(url, req)
    const result = await handleJsonResp(resp, alsoOkHttpStatuses)
    return result
  } catch (err) {
    let msg = `Failed while doing fetch() with\n`
    msg += `  URL='${url}'\n`
    msg += `  Req body='${JSON.stringify(req, null, 2)}'`
    throw chainedError(msg, err)
  }
}

export function findCommonString(string1, string2) {
  let lastSpaceIndex = 0
  for (let i = 0; i < string1.length; i++) {
    const currString1Char = string1.charAt(i)
    const currString2Char = string2.charAt(i)
    if (currString1Char === ' ') {
      lastSpaceIndex = i
    }
    const isDifferent = currString1Char !== currString2Char
    if (isDifferent) {
      break
    }
  }
  return string1.substr(0, lastSpaceIndex + 1)
}

async function handleJsonResp(resp, alsoOkHttpStatuses = []) {
  const isJson = isRespJson(resp)
  const isRespOk = resp.ok || alsoOkHttpStatuses.includes(resp.status)
  try {
    if (isRespOk && isJson) {
      return resp.json()
    }
  } catch (err) {
    throw chainedError('Failed while parsing JSON response', err)
  }
  // resp either NOT ok or NOT JSON, prep nice error msg
  const bodyAccessor = isJson ? 'json' : 'text'
  const bodyPromise = resp.bodyUsed
    ? Promise.resolve('(body already used)')
    : resp[bodyAccessor]()
  const body = await bodyPromise
  const trimmedBody =
    typeof body === 'string'
      ? body.substr(0, 300)
      : JSON.stringify(body).substr(0, 300)
  let msg = `\nResponse is either not OK or not JSON\nResp details:\n`
  msg += `  is ok=${isRespOk},\n`
  msg += `  is JSON=${isJson}\n`
  msg += `  status=${resp.status}\n`
  msg += `  statusText='${resp.statusText}'\n`
  msg += `  headers=${JSON.stringify(resp.headers)}\n`
  msg += `  url=${resp.url}\n`
  msg += `  body first 300 chars='${trimmedBody}'\n`
  const err = new Error(msg)
  err.httpStatus = resp.status
  throw err
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
    photo[fieldName] ||
      (msg += `Invalid photo record, ${fieldName}='${photo[fieldName]}' is missing. `)
  }
}

function isRespJson(resp) {
  const mimeStr = resp.headers.get('Content-Type') || ''
  return /application\/(\w+(\.\w+)*\+)?json/.test(mimeStr)
}

export function formatMetricDistance(metres) {
  if (!metres) {
    return metres
  } else if (metres < 1000) {
    return `${metres.toFixed(0)}m`
  }
  const kmVal = (metres / 1000).toFixed(1)
  return `${kmVal}km`
}

export function buildUrlSuffix(path, params = {}) {
  const querystring = Object.keys(params).reduce((accum, currKey) => {
    const value = params[currKey]
    if (isNil(value)) {
      return accum
    }
    return `${accum}${currKey}=${value}&`
  }, '')
  const qsSep = querystring ? '?' : ''
  return `${path}${qsSep}${querystring.replace(/&$/, '')}`
}

/**
 * Returns a function that can be used as a vuex getter to check if the
 * specified timestamp field has expired, so the corresponding field is
 * considered stale.
 */
export function buildStaleCheckerFn(
  stateKey,
  staleThresholdMinutes,
  /*for testing*/ timeProviderFn,
) {
  return function(state) {
    const nowMs = (timeProviderFn && timeProviderFn()) || now()
    const lastUpdatedMs = state[stateKey]
    const isNoTimestamp = !lastUpdatedMs
    const isNowLaterThanStaleThreshold =
      lastUpdatedMs + staleThresholdMinutes * 60 * 1000 < nowMs
    const isStale = isNoTimestamp || isNowLaterThanStaleThreshold
    return isStale
  }
}

export function squareAreaValueToTitle(v) {
  const sqrt = Math.sqrt(v)
  return isNaN(v) ? v : `${sqrt}x${sqrt} (${v}m²)`
}

/**
 * Takes an array of valid values and returns a validator function. The
 * validator function takes a single param and returns it as-is if valid,
 * otherwise throws an error.
 */
export function makeEnumValidator(validValues) {
  if (!Array.isArray(validValues) || !validValues.length) {
    throw new Error('Input must be a non-empty array!')
  }
  return function(enumItem) {
    const isValid = validValues.includes(enumItem)
    if (!isValid) {
      throw new Error(
        `Invalid enum value='${enumItem}' is not in valid values=[${validValues}]`,
      )
    }
    return enumItem
  }
}

export function humanDateString(dateStr) {
  if (!dateStr) {
    return '(no date recorded)'
  }
  const d = moment(dateStr)
  return `${d.fromNow()}  (${d.format('DD-MMM-YYYY HH:mm')})`
}

export function formatStorageSize(byteCount) {
  const oneMb = 1000 * 1000
  const tenMb = 10 * oneMb
  const oneGb = 1000 * oneMb
  const isZero = byteCount === 0
  if (isZero) {
    return 'nothing'
  }
  const isLessThan1mb = byteCount < oneMb
  if (isLessThan1mb) {
    return 'less than 1MB'
  }
  const isBetween1and10mb = byteCount > oneMb && byteCount < tenMb
  if (isBetween1and10mb) {
    return (byteCount / oneMb).toFixed(1) + 'MB'
  }
  const isGreaterThan10mb = byteCount > tenMb && byteCount < oneGb
  if (isGreaterThan10mb) {
    return (byteCount / oneMb).toFixed(0) + 'MB'
  }
  return (byteCount / oneGb).toFixed(1) + 'GB'
}

export function getExifFromBlob(blobish) {
  return new Promise((resolve, reject) => {
    EXIF.getData(blobish, function() {
      try {
        return resolve(EXIF.getAllTags(this))
      } catch (err) {
        return reject(err)
      }
    })
  })
}

export function wowIdOf(record) {
  return record.inatId || record.uuid
}

export function fetchRecords(url) {
  return fetch(url).then(function(resp) {
    if (!resp.ok) {
      console.error(`Made fetch() for url='${url}' but it was not ok`)
      return false
    }
    return resp.json()
  })
}

export function fetchSingleRecord(url) {
  return fetchRecords(url).then(function(body) {
    // FIXME also check for total_results > 1
    if (!body.total_results) {
      return null
    }
    return body.results[0]
  })
}

const missionStartMarker = 'START-OF-MISSION'
const missionEndMarker = 'END-OF-MISSION'
export function encodeMissionBody(name, endDate, goal) {
  const today = moment().format('DD-MMM-YYYY')
  const endDatePretty = moment(endDate).format('DD-MMM-YYYY')
  return `
  ${name}
  Start date: ${today}
  End date: ${endDatePretty}
  Goal: ${goal}
  <code style="display: none;">
  ${missionStartMarker}
  ${JSON.stringify(
    {
      name,
      startDateRaw: moment().unix(),
      endDateRaw: moment(endDate).unix(),
      goal,
    },
    null,
    2,
  )}
  ${missionEndMarker}
  // created by Wild Orchid Watch app version: ${constants.appVersion}
  </code>
  `
}

export function decodeMissionBody(body) {
  const indexOfStartMarker = body.indexOf(missionStartMarker)
  if (!~indexOfStartMarker) {
    throw new Error('No start marker, cannot parse')
  }
  const indexOfEndMarker = body.indexOf(missionEndMarker)
  if (!~indexOfEndMarker) {
    throw new Error('No end marker, cannot parse')
  }
  const usefulBitAsString = body.substring(
    indexOfStartMarker + missionStartMarker.length,
    indexOfEndMarker,
  )
  const parsed = JSON.parse(usefulBitAsString)
  return {
    ...parsed,
    startDate: moment.unix(parsed.startDateRaw).format('YYYY-MM-DD'),
    endDate: moment.unix(parsed.endDateRaw).format('YYYY-MM-DD'),
  }
}

export function isWowMissionJournalPost(bodyStr) {
  return !!~bodyStr.indexOf(missionStartMarker)
}

// Thanks for these two functions:
// https://developers.google.com/web/fundamentals/instant-and-offline/web-storage/indexeddb-best-practices#not_everything_can_be_stored_in_indexeddb_on_all_platforms
//
// Safari on iOS cannot store Blobs, which are what we get from the file input
// UI control. So we have to convert them to ArrayBuffers, which do have
// support. If we ever stop supporting Safari 10, I think these can be removed.
export function arrayBufferToBlob(buffer, type) {
  return new Blob([buffer], { type: type })
}

export function blobToArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('loadend', () => {
      resolve(reader.result)
    })
    reader.addEventListener('error', reject)
    reader.readAsArrayBuffer(blob)
  })
}

export const _testonly = {
  isRespJson,
}
