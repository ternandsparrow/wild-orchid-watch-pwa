import 'onsenui/css/onsenui.css' // Onsen UI basic CSS
import 'onsenui/css/onsen-css-components.css' // Default Onsen UI CSS components

import './wow-global.css'

import Vue from 'vue'
import VueOnsen from 'vue-onsenui' // TODO can import single modules from /esm/...
import 'pwacompat'

import '@/misc/register-service-worker'
import '@/misc/handle-network-status'
import '@/misc/handle-apple-install-prompt'
import store from '@/store'
import router from '@/router'
import AppNavigator from '@/AppNavigator'
import '@/global-components'
import * as VueGoogleMaps from 'vue2-google-maps'
import { googleMapsApiKey } from '@/misc/constants'

Vue.use(VueOnsen)
Vue.config.productionTip = false

Vue.use(VueGoogleMaps, {
  load: { key: googleMapsApiKey },
})

new Vue({
  el: '#app',
  beforeCreate() {
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
  },
  render: h => h(AppNavigator),
  router,
  store,
})
