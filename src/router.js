import Vue from 'vue'
import VueRouter from 'vue-router'

import store from '@/store'
import WowHeader from '@/pages/WowHeader'
import OauthCallback from '@/pages/OauthCallback'
import ObsDetail from '@/pages/obs-detail/index'
import Admin from '@/pages/Admin'
import NotFound from '@/pages/NotFound'

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
      path: '/obs/:id(\\d+)',
      name: 'ObsDetail',
      component: ObsDetail,
      beforeEnter(to, from, next) {
        const obsId = parseInt(to.params.id)
        store.commit('obs/setSelectedObservationId', obsId)
        if (!store.getters['obs/observationDetail']) {
          return next({ name: 'NotFound', replace: true })
        }
        return next()
      },
    },
    {
      path: '/zzadmin',
      name: 'Admin',
      component: Admin,
    },
    {
      path: '/not-found',
      name: 'NotFound',
      component: NotFound,
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
