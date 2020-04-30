import 'onsenui/css/onsenui.css' // Onsen UI basic CSS
import 'onsenui/css/onsen-css-components.css' // Default Onsen UI CSS components

import './wow-global.scss'

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

      this.$store.commit('ephemeral/setUiTraceTools', {
        ga: this.$ga,
        sentry: Sentry,
      })
      Vue.prototype.$wow = {
        uiTrace: (category, action) => {
          this.$store.dispatch('ephemeral/uiTrace', { category, action })
        },
      }

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
      this.$store.dispatch('auth/setUsernameOnSentry')

      setTimeout(() => {
        console.debug('Firing Apple install prompt check')
        initAppleInstallPrompt()
      }, 10000)

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
    this.healthcheck()
  },
  methods: {
    registerForSwMessages() {
      if (!('serviceWorker' in navigator)) {
        console.warn('no service worker, cannot register for messages')
        return
      }
      navigator.serviceWorker.addEventListener('message', event => {
        const msgId = event.data.id
        if (msgId) {
          console.debug(`Message received from SW with ID='${msgId}'`)
        }
        try {
          switch (msgId) {
            case constants.refreshObsMsg:
              this.$store
                .dispatch('obs/refreshRemoteObsWithDelay')
                .catch(err => {
                  this.$store.dispatch('flagGlobalError', {
                    msg: `Failed to refresh observations after prompt to do so from the SW`,
                    userMsg: `Error while trying to refresh your list of observations`,
                    err,
                  })
                })
              return
            default:
              console.debug('[from SW] ' + event.data)
              return
          }
        } finally {
          event.ports[0].postMessage('ACK')
        }
      })
    },
    async healthcheck() {
      try {
        await this.$store.dispatch('healthcheck')
      } catch (err) {
        this.$store.dispatch('flagGlobalError', {
          msg: 'Vuex store failed startup healthcheck',
          userMsg:
            'Failed to set up local app database. This app will not work properly. ' +
            'To fix this, make sure your browser is up to date. ' +
            'Private/Incognito/Secret mode in some browsers will also cause this.',
          err,
        })
      }
    },
  },
  render: h => h(AppNavigator),
  router,
  store,
})
