import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import * as cc from '@/misc/constants'
import {
  arrayBufferToBlob,
  blobToArrayBuffer,
  ChainedError,
  getExifFromBlob,
  iterateIdb,
  now,
  recordTypeEnum,
  // Prefer to dispatch('flagGlobalError') as that will inform the UI and call
  // wowErrorHandler eventually
  wowErrorHandler,
  wowWarnHandler,
  wowWarnMessage,
} from './only-common-deps-helpers'

export {
  arrayBufferToBlob,
  blobToArrayBuffer,
  ChainedError,
  getExifFromBlob,
  iterateIdb,
  now,
  recordTypeEnum,
  wowErrorHandler,
  wowWarnHandler,
  wowWarnMessage,
}

dayjs.extend(duration)
dayjs.extend(relativeTime)

const commonHeaders = {
  Accept: 'application/json',
}

const jsonHeaders = {
  'Content-Type': 'application/json',
  ...commonHeaders,
}

export function postJson(url, data = {}) {
  const authHeaderValue = null
  return postJsonWithAuth(url, data, authHeaderValue)
}

export function postJsonWithAuth(url, data, authHeaderValue) {
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

export function putJsonWithAuth(url, data, authHeaderValue) {
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

export function postFormDataWithAuth(...params) {
  return _formDataWithAuthHelper('POST', ...params)
}

export function putFormDataWithAuth(...params) {
  return _formDataWithAuthHelper('PUT', ...params)
}

async function _formDataWithAuthHelper(
  method,
  url,
  populateFormDataCallback,
  authHeaderValue,
) {
  const formData = new FormData()
  await populateFormDataCallback(formData)
  return doManagedFetch(url, {
    method,
    mode: 'cors',
    headers: {
      ...commonHeaders,
      Authorization: authHeaderValue,
    },
    body: formData._blob ? formData._blob() : formData,
  })
}

export function getJsonNoAuth(url, includeCacheBustQueryString) {
  return getJsonWithAuth(url, undefined, includeCacheBustQueryString)
}

export function getJsonWithAuth(
  url,
  authHeaderValue,
  includeCacheBustQueryString = true,
) {
  // supplying cache: 'no-store' to fetch() works perfectly except for iOS
  // Safari which explodes, so we have to fall back to this dirty way of cache
  // busting
  const urlToUse = (() => {
    if (!includeCacheBustQueryString) {
      return url
    }
    const isQueryStringPresent = url.includes('?')
    const cacheBustSeparator = isQueryStringPresent ? '&' : '?'
    const urlWithCacheBust = `${url}${cacheBustSeparator}cache-bust=${now()}`
    return urlWithCacheBust
  })()
  return doManagedFetch(urlToUse, {
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
    const resp = await fetch(cc.serviceWorkerIsAliveMagicUrl, {
      method: 'GET',
      retries: 0,
    })
    return resp.ok // if we get a response, it should be ok
  } catch (err) {
    return false
  }
}

export function deleteWithAuth(url, authHeaderValue) {
  const alsoOkHttpStatuses = [404]
  const extraHeaders = {}
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

async function doManagedFetch(url, init, alsoOkHttpStatuses) {
  try {
    const resp = await fetch(url, init)
    const result = await handleJsonResp(resp, alsoOkHttpStatuses)
    return result
  } catch (err) {
    if (isDowngradable(err.message)) {
      const result = ChainedError(
        '[Downgraded error] something went wrong during fetch that we cannot control',
        err,
      )
      result.isDowngradable = true
      throw result
    }
    const isNetworkErrorWow = err.message === 'Failed to fetch'
    let msg = `Failed while doing fetch() with\n`
    msg += `  URL='${url}'\n`
    msg += `  Req body='${JSON.stringify(init, null, 2)}'`
    const result = ChainedError(msg, err)
    try {
      result.isNetworkErrorWow = isNetworkErrorWow
    } catch (err2) {
      wowWarnHandler(
        `Could not set property on error object. It's only for a nicer UX, ` +
          `so continuing without it`,
        err2,
      )
    }
    throw result
  }
}

function isDowngradable(msg) {
  // there are number of error related to fetching that aren't good but also
  // there's nothing we can do about it. Things like network dropping out. Here
  // we build a list of error messages that indicate those situations and
  // downgrade the errors to warnings. The system operators still should know
  // they're happening but we don't want them to panic.
  const downgradableMessages = ['The network connection was lost']
  return downgradableMessages.some((e) => msg.includes(e))
}

export function findCommonString(string1, string2) {
  let lastSpaceIndex = 0
  for (let i = 0; i < string1.length; i += 1) {
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
  if (isRespOk && isJson) {
    const clonedResp = resp.clone()
    try {
      const result = await resp.json()
      return result
    } catch (err) {
      const isEmtpyResp = (await clonedResp.text()).length === 0
      if (isEmtpyResp) {
        // Including obs field values and/or project_id in the POST
        // /v1/observations request seems to trigger this, see
        // https://github.com/inaturalist/iNaturalistAPI/issues/200.  It would
        // be even nicer if we could determine length without this mess but the
        // "Content-Length" header isn't present when this happens (unless that
        // *is* the indicator).
        throw ChainedError('Empty 200 JSON response', err)
      }
      throw ChainedError('Failed while parsing JSON response', err)
    }
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
 * object but it still shows linkage between all the locations we map
 * (hopefully not many).
 */
export function verifyWowDomainPhoto(photo) {
  let msg = ''
  assertFieldPresent('id')
  assertFieldPresent('url')
  if (msg) {
    throw new Error(msg)
  }

  function assertFieldPresent(fieldName) {
    if (!photo[fieldName]) {
      msg += `Invalid photo record, ${fieldName}='${photo[fieldName]}' is missing. `
    }
  }
}

function isRespJson(resp) {
  const mimeStr = resp.headers.get('Content-Type') || ''
  return /application\/(\w+(\.\w+)*\+)?json/.test(mimeStr)
}

export function formatMetricDistance(metres) {
  if (!metres) {
    return metres
  }
  if (metres < 1000) {
    return `${metres.toFixed(0)}m`
  }
  const kmVal = (metres / 1000).toFixed(1)
  return `${kmVal}km`
}

export function buildUrlSuffix(path, params = {}) {
  const querystring = Object.keys(params).reduce((accum, currKey) => {
    const value = params[currKey]
    if (value == null) {
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
  /* for testing */ timeProviderFn,
) {
  return function (state) {
    const nowMs = (timeProviderFn && timeProviderFn()) || now()
    const lastUpdatedMs = state[stateKey]
    const isNoTimestamp = !lastUpdatedMs
    const isNowLaterThanStaleThreshold =
      lastUpdatedMs + staleThresholdMinutes * 60 * 1000 < nowMs
    const isStale = isNoTimestamp || isNowLaterThanStaleThreshold
    return isStale
  }
}

export function isNotPositiveInteger(str) {
  // isNaN doesn't do what you think it does
  return !/^\d+$/.test(str)
}

export function rectangleAlongPathAreaValueToTitle(v) {
  if (isNotPositiveInteger(v)) {
    const ltPrefix = 'less than'
    const isLessThanTypedArea = v.startsWith(ltPrefix)
    if (isLessThanTypedArea) {
      const halfV = parseInt(v.replace(ltPrefix, ''), 10) / 2
      return doFormat(v, halfV, halfV)
    }
    return v
  }
  const fixedDimension = 2
  const isSmallArea = v < fixedDimension
  if (isSmallArea) {
    const onlyDimension = Math.sqrt(v)
    return doFormat(v, onlyDimension, onlyDimension)
  }
  const varyingDimension = v / fixedDimension
  return doFormat(v, varyingDimension, fixedDimension)
  function doFormat(val, x, y) {
    return `${val}m² (i.e. ${x}x${y} or similar)`
  }
}

export function humanDateString(dateStr) {
  if (!dateStr) {
    return '(no date recorded)'
  }
  const d = dayjs(dateStr)
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
    return `${(byteCount / oneMb).toFixed(1)}MB`
  }
  const isGreaterThan10mb = byteCount > tenMb && byteCount < oneGb
  if (isGreaterThan10mb) {
    return `${(byteCount / oneMb).toFixed(0)}MB`
  }
  return `${(byteCount / oneGb).toFixed(1)}GB`
}

export function wowIdOf(record) {
  return record.inatId || record.uuid
}

export function fetchRecords(url) {
  return fetch(url).then(function (resp) {
    if (!resp.ok) {
      console.error(`Made fetch() for url='${url}' but it was not ok`)
      return false
    }
    return resp.json()
  })
}

export function fetchSingleRecord(url) {
  return fetchRecords(url).then(function (body) {
    // FIXME also check for total_results > 1
    if (!body.total_results) {
      return null
    }
    return body.results[0]
  })
}

const missionStartMarker = 'START-OF-MISSION'
const missionEndMarker = 'END-OF-MISSION'
export function encodeMissionBody(name, endDate, goal, todayMoment = dayjs()) {
  const todayStr = todayMoment.format('DD-MMM-YYYY')
  const endDatePretty = dayjs(endDate).format('DD-MMM-YYYY')
  return `
  ${name}
  Start date: ${todayStr}
  End date: ${endDatePretty}
  Goal: ${goal}
  <code style="display: none;">
  ${missionStartMarker}
  ${JSON.stringify(
    {
      name,
      startDateRaw: todayMoment.unix(),
      endDateRaw: dayjs(endDate).unix(),
      goal,
    },
    null,
    2,
  )}
  ${missionEndMarker}
  // created by Wild Orchid Watch app version: ${cc.appVersion}
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
    startDate: dayjs.unix(parsed.startDateRaw).format('YYYY-MM-DD'),
    endDate: dayjs.unix(parsed.endDateRaw).format('YYYY-MM-DD'),
  }
}

export function isWowMissionJournalPost(bodyStr) {
  return !!~bodyStr.indexOf(missionStartMarker)
}

export function clearLocalStorage() {
  console.debug(`Clearing localStorage of ${localStorage.length} keys`)
  localStorage.clear()
}

// thanks https://love2dev.com/blog/how-to-uninstall-a-service-worker/
export function unregisterAllServiceWorkers() {
  if (!navigator.serviceWorker) {
    return
  }
  navigator.serviceWorker.getRegistrations().then((regs) => {
    console.debug(`Unregistering ${regs.length} service workers`)
    for (const curr of regs) {
      curr.unregister()
    }
  })
}

export function isInBoundingBox(lat, lon) {
  return isInBoundingBoxImpl({
    userLat: lat,
    userLon: lon,
    minLat: cc.bboxLatMin,
    maxLat: cc.bboxLatMax,
    minLon: cc.bboxLonMin,
    maxLon: cc.bboxLonMax,
  })
}

function isInBoundingBoxImpl({
  userLat,
  userLon,
  minLat,
  maxLat,
  minLon,
  maxLon,
}) {
  const isLatInBox = minLat < userLat && userLat < maxLat
  const isLonInBox = minLon < userLon && userLon < maxLon
  return isLatInBox && isLonInBox
}

// Creates a named error
// The problem with this is the stack trace will point to here, no the calling
// function. So maybe it's not a great idea to use this. I'm undecided.
export function namedError(name, msg) {
  const result = new Error(msg)
  result.name = name
  return result
}

export function convertExifDateStr(exifDateStr) {
  if (!exifDateStr) {
    return exifDateStr
  }
  return exifDateStr.replace(':', '-').replace(':', '-')
}

export const _testonly = {
  isRespJson,
  isInBoundingBoxImpl,
  doManagedFetch,
}
