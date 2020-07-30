// in an effort to keep the SW small, we need to stop an exploding number of
// transient imports. This module is essentially the same as helpers.js but
// with only the imports that both the SW and main code use.
import * as Sentry from '@sentry/browser' // piggybacks on the config done in whatever thread imports us

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
    // FIXME can we detect and handle a ProgressEvent and get details from
    // err.target.error.code (and lookup name of error by getting key for the
    // code on .error)
    const newMsg = `${msg}\nCaused by: ${err.message}`
    try {
      err.message = newMsg
      return err
    } catch (err2) {
      // Store a blob in Safari's IndexedDB on iOS (not macOS) and it will
      // throw an error with message = "An unknown error occurred within
      // Indexed Database.". That error will have the 'message' property set as
      // readonly and that's how you get here. Probably any DOMException is the
      // same.
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
    openRequest.onupgradeneeded = e => {
      // if an upgrade is needed, the requested DB version did NOT exist
      e.target.transaction.abort()
      console.debug(
        `IndexedDB database ${dbName}, version ${dbVersion}, does not exist, ` +
          `skipping migration`,
      )
      return resolve([])
    }
    openRequest.onerror = () => {
      reject(
        chainedError(
          `Failed to open IndexedDB '${dbName}' (version ${dbVersion})`,
          openRequest.error,
        ),
      )
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
