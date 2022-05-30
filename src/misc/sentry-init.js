import * as Sentry from '@sentry/browser'
import * as constants from '@/misc/constants'

let isInited = false

export default function sentryInit(initLocationName, extraInitArgs = {}) {
  if (isInited) {
    return Sentry
  }
  isInited = true
  if (process.env.NODE_ENV === 'test') {
    return Sentry
  }
  if (constants.sentryDsn === 'off') {
    console.debug(
      `No sentry DSN provided, refusing to init Sentry in ${initLocationName}`,
    )
  } else {
    Sentry.init({
      dsn: constants.sentryDsn,
      release: constants.appVersion,
      environment: constants.deployedEnvName,
      ...extraInitArgs,
    })
  }
  return Sentry
}
