import * as Sentry from '@sentry/browser'
import * as cc from '@/misc/constants'

let isInited = false

export default function sentryInit(initLocationName, extraInitArgs = {}) {
  if (isInited) {
    return Sentry
  }
  isInited = true
  if (process.env.NODE_ENV === 'test') {
    return Sentry
  }
  if (cc.sentryDsn === 'off') {
    console.debug(
      `No sentry DSN provided, refusing to init Sentry in ${initLocationName}`,
    )
  } else {
    Sentry.init({
      dsn: cc.sentryDsn,
      release: cc.appVersion,
      environment: cc.deployedEnvName,
      ...extraInitArgs,
    })
  }
  return Sentry
}
