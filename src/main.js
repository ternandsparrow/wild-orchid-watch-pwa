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
import * as constants from '@/misc/constants'
import { wowErrorHandler } from '@/misc/helpers'

Vue.use(VueOnsen)
Vue.config.productionTip = false

Vue.use(VueGoogleMaps, {
  load: { key: constants.googleMapsApiKey },
})

smoothscroll.polyfill()

if (constants.googleAnalyticsTrackerCode !== 'off') {
  Vue.use(VueAnalytics, {
    id: constants.googleAnalyticsTrackerCode,
    router,
  })
}

if (process.env.NODE_ENV !== 'development') {
  // don't init Sentry during dev, otherwise it won't print render errors to
  // the console, see https://github.com/vuejs/vue/issues/8433
  Sentry.init({
    dsn: constants.sentryDsn,
    integrations: [new Integrations.Vue({ Vue, attachProps: true })],
    release: constants.appVersion,
  })
  Sentry.configureScope(scope => {
    scope.setTag('environment', constants.deployedEnvName)
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

      this.$store.dispatch('auth/sendSwUpdatedAuthToken')

      // TODO WOW-136 should we delay this so it doesn't show over the
      // onboarder?
      initAppleInstallPrompt()

      this.$store.dispatch('obs/refreshLocalRecordQueue')
    } catch (err) {
      wowErrorHandler('Failed to run beforeCreate for root element', err)
      alert(
        'Failed to start app, sorry. Try restarting the app to fix the problem.',
      )
    }
  },
  mounted() {
    this.registerForSwMessages()
  },
  methods: {
    registerForSwMessages() {
      if (!('serviceWorker' in navigator)) {
        console.warn('no service worker, cannot register for messages')
        return
      }
      navigator.serviceWorker.addEventListener('message', event => {
        // FIXME maybe this shouldn't have so much responsibility and the SW
        // should directly update the status of records. I'm worried about:
        //  - user saves record
        //  - process sends it to SW
        //  - SW starts processing
        //  - our app is closed, loses focus, crashes, phone is turned off
        //  - SW completes processing, send message
        // There's no client to accept that message. And if that's the only
        // point that we update the status for records, we're in trouble.
        const obsUuid = event.data.obsUuid
        const wowId = obsUuid || event.data.obsId
        const msgId = event.data.id
        console.debug(`Message received from SW with ID='${msgId}'`)
        switch (msgId) {
          case constants.refreshObsMsg:
            this.$store.dispatch('obs/refreshRemoteObs')
            break
          case constants.obsPostSuccessMsg:
          case constants.obsPutSuccessMsg:
          case constants.obsDeleteSuccessMsg:
            this.$store
              .dispatch('obs/transitionToSuccessOutcome', wowId)
              .then(() => {
                return this.$store.dispatch('obs/refreshRemoteObs')
              })
              .catch(err => {
                this.$store.dispatch('flagGlobalError', {
                  msg: `Failed to set outcome=success for Db record with wowId='${wowId}'`,
                  // FIXME use something more user friendly than the ID
                  userMsg: `Error while trying to upload record with wowId='${wowId}'`,
                  err,
                })
              })
            break
          case constants.failedToUploadObsMsg:
            // FIXME differentiate between systemError and userError
            return this.transitionToSystemErrorHelper(wowId, 'upload')
          case constants.failedToEditObsMsg:
            // FIXME differentiate between systemError and userError
            return this.transitionToSystemErrorHelper(wowId, 'edit')
          case constants.failedToDeleteObsMsg:
            // FIXME differentiate between systemError and userError
            return this.transitionToSystemErrorHelper(wowId, 'delete')
          default:
            console.debug('Client received message from SW: ' + event.data)
        }
      })
    },
    async transitionToSystemErrorHelper(wowId, msgFragment) {
      try {
        await this.$store.dispatch('obs/transitionToSystemErrorOutcome', wowId)
      } catch (err) {
        this.$store.dispatch('flagGlobalError', {
          msg: `Failed to set outcome=systemError for Db record with wowId='${wowId}'`,
          // FIXME use something more user friendly than the ID
          userMsg: `Error while trying to ${msgFragment} record with wowId='${wowId}'`,
          err,
        })
      }
    },
  },
  render: h => h(AppNavigator),
  router,
  store,
})
