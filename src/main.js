import 'onsenui/css/onsenui.css' // Onsen UI basic CSS
import 'onsenui/css/onsen-css-components.css' // Default Onsen UI CSS components
import './vue-onsenui-wow.css' // CSS specific to this app

import Vue from 'vue'

import VueOnsen from 'vue-onsenui' // TODO can import single modules from /esm/...

import AppNavigator from './AppNavigator.vue'
import CustomToolbar from './partials/CustomToolbar.vue'

import store from '@/store'
import '@/misc/register-service-worker'
import '@/misc/handle-network-status'
import '@/firebase/init'
import '@/firebase/authentication'
import '@/misc/handle-apple-install-prompt'
import 'pwacompat'

Vue.use(VueOnsen)
Vue.component('custom-toolbar', CustomToolbar) // Common toolbar
Vue.config.productionTip = false

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
  },
  render: h => h(AppNavigator),
  store,
})
