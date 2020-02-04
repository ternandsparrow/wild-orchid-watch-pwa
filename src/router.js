import Vue from 'vue'
import VueRouter from 'vue-router'

import store from '@/store'
import Admin from '@/pages/Admin'
import FAQ from '@/pages/faq/index'
import HelpPage from '@/pages/HelpPage'
import NotFound from '@/pages/NotFound'
import OauthCallback from '@/pages/OauthCallback'
import ObsDetail from '@/pages/obs-detail/ObsDetail'
import Onboarder from '@/pages/Onboarder'
import OrchidScience from '@/pages/orchid-science/index'
import Settings from '@/pages/Settings'
import SingleSpecies from '@/pages/new-obs/SingleSpecies'
import WowHeader from '@/pages/WowHeader'
import { mainStackReplace } from '@/misc/nav-stacks'

const uuidRegex =
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

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
      path: `/obs/:id(\\d+|${uuidRegex})`,
      name: 'ObsDetail',
      component: ObsDetail,
      beforeEnter: resolveObsByIdOrNotFound,
    },
    {
      path: `/obs/:id(\\d+|${uuidRegex})/edit`, // FIXME does this work?
      name: 'ObsEdit',
      component: SingleSpecies,
      beforeEnter: resolveObsByIdOrNotFound,
      meta: {
        isEdit: true,
      },
    },
    {
      path: '/obs/new',
      name: 'ObsNewSingleSpecies',
      component: SingleSpecies,
      meta: {
        isEdit: false,
      },
    },
    // TODO use /obs/new-community for multiple species
    // TODO use /obs/new-mapping for mapping record
    {
      path: '/onboarder',
      name: 'Onboarder',
      component: Onboarder,
    },
    {
      path: '/help',
      name: 'HelpPage',
      component: HelpPage,
    },
    {
      path: '/settings',
      name: 'Settings',
      component: Settings,
    },
    {
      path: '/science',
      name: 'OrchidScience',
      component: OrchidScience,
    },
    {
      path: '/faq',
      name: 'FAQ',
      component: FAQ,
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
  if (store.state.ephemeral.isWarnOnLeaveRoute) {
    const resp = window.confirm(
      'WARNING are you sure you want to leave? You will lose any unsaved work',
    )
    if (resp) {
      store.commit('ephemeral/disableWarnOnLeaveRoute')
    } else {
      return next(false)
    }
  }
  // Reset pageStack to the new route
  const matchedComponents = to.matched.map(m => m.components.default)
  mainStackReplace(matchedComponents)
  next()
})

function resolveObsByIdOrNotFound(to, from, next) {
  const wowId = isNaN(to.params.id) ? to.params.id : parseInt(to.params.id)
  store.commit('obs/setSelectedObservationId', wowId)
  if (!store.getters['obs/observationDetail']) {
    console.debug(`Could not find obs record for wowId=${wowId}`)
    return next({ name: 'NotFound', replace: true })
  }
  return next()
}

export default router
