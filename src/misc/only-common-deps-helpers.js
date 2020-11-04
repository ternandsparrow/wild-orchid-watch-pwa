// in an effort to keep the SW small, we need to stop an exploding number of
// transient imports. This module is essentially the same as helpers.js but
// with only the imports that both the SW and main code use.
import EXIF from 'exif-js'
import sentryInit from '@/misc/sentry-init'

// it's not ideal that we have to pass this param as we really want to know
// where this module was imported from, but that's difficult.
const Sentry = sentryInit('only-obs-common-deps-helpers')

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

// for errors that are only warnings
export function wowWarnHandler(msg, err) {
  console.warn(msg, err || '(no error object passed)')
  Sentry.withScope(scope => {
    scope.setLevel('warning')
    Sentry.captureException(chainedError(msg, err))
  })
}

// for warn messages, send errors to wowWarnHandler
export function wowWarnMessage(msg) {
  console.warn(msg)
  Sentry.withScope(function(scope) {
    scope.setLevel('warning')
    Sentry.captureMessage(msg)
  })
}

export function chainedError(msg, err) {
  if (!err) {
    return new Error(
      `${msg}\nWARNING: chainedError was called without an error to chain`,
    )
  }
  if (typeof err === 'object') {
    // TODO can we detect and handle a ProgressEvent and get details from
    // err.target.error.code (and lookup name of error by getting key for the
    // code on .error)
    const newMsg = `${msg}\nCaused by: ${err.message}`
    if (isImmutableError(err)) {
      // we can't construct a new DOMException because support for the
      // constructor isn't great.
      return new Error(
        newMsg +
          `\nOriginal stack (immutable original error forced ` +
          `creation of a new Error with new stack):\n${err.stack}`,
      )
    }
    try {
      err.message = newMsg
      return err
    } catch (err2) {
      // We get here by trying to modify an immutable Error. DOMException seems
      // to always be but there may be others.
      console.warn(
        `While handling the first error:\n` +
          `  [name=${err.name}, type=${
            (err.constructor || {}).name
          }] ${err.message || '(no message)'}\n` +
          `encountered this error:\n` +
          `  ${err2.message}\n` +
          `but we're working around it! Bubbling original error now.`,
      )
      return new Error(
        newMsg +
          `\nOriginal stack (readonly Error.message forced ` +
          `creation of a new Error with new stack):\n${err.stack}`,
      )
    }
  }
  return new Error(`${msg}\nCaused by: ${err}`)
}

function isImmutableError(err) {
  return self.DOMException && err instanceof DOMException
}

export function now() {
  return Date.now()
}

export function makeObsRequest(obsObj, projectId, photoIds) {
  const result = {
    ...obsObj,
    local_photos: {
      0: photoIds,
    },
    uploader: true,
    refresh_index: true,
  }
  if (projectId) {
    // no need to re-link project if it's already linked
    result.project_id = [projectId]
  }
  return result
}

export function addPhotoIdToObsReq(obsReq, photoId) {
  const photoArray = ((obsReq || {}).local_photos || {})[0]
  if (!photoArray) {
    throw new Error(
      `Supplied obs object='${JSON.stringify(obsReq)}' did not have a ` +
        `'local_photos' attribute for us to manipulate, cannot continue`,
    )
  }
  photoArray.push(photoId)
}

export function iterateIdb(
  dbName,
  dbVersion,
  objectStoreName,
  cursorMapFn,
  isWrite = false,
) {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(dbName, dbVersion)
    let dontPanicWeCalledTheAbort = false
    openRequest.onupgradeneeded = e => {
      // if an upgrade is needed, the requested DB version did NOT exist
      e.target.transaction.abort()
      dontPanicWeCalledTheAbort = true
      console.debug(
        `IndexedDB database ${dbName}, version ${dbVersion}, does not exist, ` +
          `skipping migration`,
      )
      return resolve([])
    }
    openRequest.onerror = () => {
      if (dontPanicWeCalledTheAbort) {
        return
      }
      const isVersionError = openRequest.error.name === 'VersionError'
      const newErr = chainedError(
        `Failed to open IndexedDB '${dbName}' (version ${dbVersion})`,
        openRequest.error,
      )
      if (isVersionError) {
        newErr.isVersionError = true
      }
      reject(newErr)
    }
    openRequest.onsuccess = e => {
      const database = e.target.result
      const mode = isWrite ? 'readwrite' : 'readonly'
      try {
        const transaction = database.transaction([objectStoreName], mode)
        const mappedItems = new Set()
        const objectStore = transaction.objectStore(objectStoreName)
        const request = objectStore.openCursor()
        request.addEventListener('success', e => {
          const cursor = e.target.result
          if (cursor) {
            const mapped = cursorMapFn(cursor)
            if (mapped) {
              mappedItems.add(mapped)
            }
            cursor.continue()
            return
          }
          const result = []
          for (const curr of mappedItems.keys()) {
            result.push(curr)
          }
          database.close()
          return resolve(result)
        })
        request.addEventListener('error', reject)
      } catch (err) {
        database.close()
        if (err.name === 'NotFoundError') {
          return resolve([])
        }
        return reject(
          chainedError(`Failed to open objectStore '${objectStoreName}'`, err),
        )
      }
    }
  })
}

export function getExifFromBlob(blobish) {
  return new Promise((resolve, reject) => {
    EXIF.getData(blobish, function(err) {
      try {
        if (err) {
          return reject(chainedError('Failed to extract EXIF', err))
        }
        const result = EXIF.getAllTags(this)
        return resolve(result)
      } catch (err) {
        return reject(chainedError('Failed to work with extracted EXIF', err))
      }
    })
  })
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

export const recordTypeEnum = makeEnumValidator(['delete', 'edit', 'new'])

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
