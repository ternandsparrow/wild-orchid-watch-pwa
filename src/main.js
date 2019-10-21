import 'onsenui/css/onsenui.css' // Onsen UI basic CSS
import 'onsenui/css/onsen-css-components.css' // Default Onsen UI CSS components

import './wow-global.css'

import Vue from 'vue'
import VueOnsen from 'vue-onsenui' // TODO can import single modules from /esm/...
import VueAnalytics from 'vue-analytics'
import 'pwacompat'
import * as Sentry from '@sentry/browser'
import * as Integrations from '@sentry/integrations'
import * as VueGoogleMaps from 'vue2-google-maps'
import smoothscroll from 'smoothscroll-polyfill'

import '@/misc/register-service-worker'
import '@/misc/handle-network-status'
import initAppleInstallPrompt from '@/misc/handle-apple-install-prompt'
import store, { migrateOldStores } from '@/store'
import router from '@/router'
import AppNavigator from '@/AppNavigator'
import '@/global-components'
import {
  appVersion,
  deployedEnvName,
  googleAnalyticsTrackerCode,
  googleMapsApiKey,
  sentryDsn,
} from '@/misc/constants'
import { wowErrorHandler } from '@/misc/helpers'

Vue.use(VueOnsen)
Vue.config.productionTip = false

Vue.use(VueGoogleMaps, {
  load: { key: googleMapsApiKey },
})

smoothscroll.polyfill()

if (googleAnalyticsTrackerCode !== 'off') {
  Vue.use(VueAnalytics, {
    id: googleAnalyticsTrackerCode,
    router,
  })
}

if (process.env.NODE_ENV !== 'development') {
  // don't init Sentry during dev, otherwise it won't print render errors to
  // the console, see https://github.com/vuejs/vue/issues/8433
  Sentry.init({
    dsn: sentryDsn,
    integrations: [new Integrations.Vue({ Vue, attachProps: true })],
    release: appVersion,
  })
  Sentry.configureScope(scope => {
    scope.setTag('environment', deployedEnvName)
  })
}

new Vue({
  el: '#app',
  beforeCreate() {
    try {
      migrateOldStores(this.$store)

      // Shortcut for Material Design
      Vue.prototype.md = this.$ons.platform.isAndroid()

      // Set iPhoneX flag based on URL
      if (window.location.search.match(/iphonex/i)) {
        document.documentElement.setAttribute('onsflag-iphonex-portrait', '')
        document.documentElement.setAttribute('onsflag-iphonex-landscape', '')
      }

      window.addEventListener('focus', () => {
        if (!this.$store.state.ephemeral.networkOnLine) {
          return
        }
        this.$store.dispatch('ephemeral/manualServiceWorkerUpdateCheck')
      })

      // TODO should we delay this so it doesn't show over the onboarder?
      initAppleInstallPrompt()

      this.$store.dispatch('obs/refreshLocalRecordQueue')
    } catch (err) {
      wowErrorHandler('Failed to run beforeCreate for root element', err)
      alert(
        'Failed to start app, sorry. Try restarting the app to fix the problem.',
      )
    }
  },
  render: h => h(AppNavigator),
  router,
  store,
})
