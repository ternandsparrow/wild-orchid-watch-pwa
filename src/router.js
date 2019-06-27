import Vue from 'vue'
import VueRouter from 'vue-router'

import store from '@/store'
import WowHeader from '@/pages/WowHeader'
import OauthCallback from '@/pages/OauthCallback'

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
      props: route => {
        console.log(route)
        return { code: route.query.code }
      },
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
