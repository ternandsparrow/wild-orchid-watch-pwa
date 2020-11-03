import * as Sentry from '@sentry/browser'
import * as constants from '@/misc/constants'

export default function sentryInit(initLocationName, extraInitArgs = {}) {
  if (process.env.NODE_ENV === 'test') {
    return Sentry
  }
  if (constants.sentryDsn === 'off') {
    console.debug(
      'No sentry DSN provided, refusing to init Sentry in ' + initLocationName,
    )
  } else {
    Sentry.init({
      dsn: constants.sentryDsn,
      release: constants.appVersion,
      ...extraInitArgs,
    })
    Sentry.configureScope(scope => {
      scope.setTag('environment', constants.deployedEnvName)
    })
  }
  return Sentry
}
