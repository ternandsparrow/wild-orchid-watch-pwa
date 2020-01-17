// in an effort to keep the SW small, we need to stop an exploding number of
// transient imports. This module is essentially the same as helpers.js but
// with no imports.

export function chainedError(msg, err) {
  if (!err) {
    return new Error(
      `${msg}\nWARNING: chainedError was called without an error to chain`,
    )
  }
  if (typeof err === 'object') {
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
