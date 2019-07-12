import Vue from 'vue'
import VueRouter from 'vue-router'

import store from '@/store'
import WowHeader from '@/pages/WowHeader'
import OauthCallback from '@/pages/OauthCallback'
import Admin from '@/pages/Admin'

Vue.use(VueRouter)

const router = new VueRouter({
  mode: 'history',
  routes: [
    {
      path: '/',
      name: 'Home',
      component: WowHeader,
    },
    {
      path: '/oauth-callback',
      name: 'OauthCallback',
      component: OauthCallback,
    },
    {
      path: '/zzadmin',
      name: 'Admin',
      component: Admin,
    },
    {
      path: '**', // catch all
      redirect: '/',
    },
  ],
})

router.beforeEach((to, from, next) => {
  // Reset pageStack to the new route
  store.commit('navigator/reset', to.matched.map(m => m.components.default))
  next()
})

export default router
