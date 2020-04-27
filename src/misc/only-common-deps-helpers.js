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
    // FIXME can we detect and handle a ProgressEvent and get details from err.target.error.code (and lookup name of error by getting key for the code on .error)
    const newMsg = `${msg}\nCaused by: ${err.message}`
    try {
      err.message = newMsg
      return err
    } catch (err2) {
      // Store a blob in Safari's IndexedDB on iOS (not macOS) and it will
      // throw an error with message = "An unknown error occurred within
      // Indexed Database.". That error will have the 'message' property set as
      // readonly and that's how you get here.
      console.warn(
        `While handling another error, encountered this error ` +
          `(but we're working around it):${err2.message}`,
      )
      return new Error(
        newMsg +
          `\nOriginal stack (readonly Error.message forced ` +
          `creation of a new Error):\n${err.stack}`,
      )
    }
  }
  return new Error(`${msg}\nCaused by: ${err}`)
}

export function now() {
  return Date.now()
}
