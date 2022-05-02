import 'onsenui/css/onsenui.css' // Onsen UI basic CSS
import 'onsenui/css/onsen-css-components.css' // Default Onsen UI CSS components

import './wow-global.scss'

import Vue from 'vue'
import VueOnsen from 'vue-onsenui' // TODO can import single modules from /esm/...
import VueAnalytics from 'vue-analytics'
import 'pwacompat'
import * as Integrations from '@sentry/integrations'
import * as VueGoogleMaps from 'gmap-vue'
import smoothscroll from 'smoothscroll-polyfill'

import sentryInit from '@/misc/sentry-init'
import '@/misc/register-service-worker'
import '@/misc/handle-network-status'
import initAppleInstallPrompt from '@/misc/handle-apple-install-prompt'
import store, { migrateOldStores } from '@/store'
import router from '@/router'
import AppNavigator from '@/AppNavigator'
import '@/global-components'
import * as constants from '@/misc/constants'
import { wowErrorHandler } from '@/misc/helpers'

if (constants.isForceVueDevtools) {
  Vue.config.devtools = true
}

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

const Sentry = sentryInit('main thread', {
  integrations: [new Integrations.Vue({ Vue, attachProps: true })],
})

new Vue({
  el: '#app',
  beforeCreate() {
    try {
      migrateOldStores(this.$store).catch(err => {
        this.$store.dispatch('flagGlobalError', {
          msg: `Failed to initiate/run all Vuex/DB migrations`,
          userMsg: 'Failed to update app from previous version',
          err,
        })
      })

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
              ;(async () => {
                // we refresh the local queue immediately so we can see the
                // record is marked as "success"
                await this.$store.dispatch('obs/refreshLocalRecordQueue')
                await this.$store.dispatch('obs/refreshRemoteObsWithDelay')
              })().catch(err => {
                this.$store.dispatch('flagGlobalError', {
                  msg:
                    `Failed to refresh observations after prompt to do so ` +
                    `from the SW`,
                  userMsg: `Error while trying to refresh your list of observations`,
                  err,
                })
              })
              return
            case constants.refreshLocalQueueMsg:
              this.$store.dispatch('obs/refreshLocalRecordQueue').catch(err => {
                this.$store.dispatch('flagGlobalError', {
                  msg:
                    `Failed to refresh local observation queue after prompt ` +
                    `to do so from the SW`,
                  userMsg: `Error while trying to refresh your list of observations`,
                  err,
                })
              })
              return
            case constants.triggerLocalQueueProcessingMsg:
              // we don't trigger the processing right now, as the web page
              // needs to reload to use the app code and the new service
              // worker. We want the processing to happen after the refresh
              // though, so we set the appropriate flag.
              this.$store.commit(
                'obs/setForceQueueProcessingAtNextChance',
                true,
              )
              return
            default:
              console.debug('[unhandled message from SW] ' + event.data)
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
