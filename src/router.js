import Vue from 'vue'
import VueRouter from 'vue-router'

import store from '@/store'
import {
  mainStackReplace,
  isOnboarderVisible as isOnboarderVisibleFn,
} from '@/misc/nav-stacks'
import { onboarderPath } from '@/misc/constants'
import { wowWarnHandler } from '@/misc/helpers'

import Admin from '@/pages/Admin'
import BugReport from '@/pages/BugReport'
import FAQ from '@/pages/faq/index'
import Gallery from '@/pages/obs/Gallery'
import HelpPage from '@/pages/HelpPage'
import Missions from '@/pages/missions/Available'
import MissionsNew from '@/pages/missions/New'
import MyObs from '@/pages/obs/MyObs'
import News from '@/pages/News'
import NotFound from '@/pages/NotFound'
import OauthCallback from '@/pages/OauthCallback'
import ObsDetail from '@/pages/obs-detail/ObsDetail'
import Onboarder from '@/pages/Onboarder'
import OrchidScience from '@/pages/orchid-science/index'
import Search from '@/pages/Search'
import Settings from '@/pages/Settings'
import SingleSpecies from '@/pages/new-obs/SingleSpecies'
import Species from '@/pages/obs/Species'

const uuidRegex =
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const homeComponent = MyObs

Vue.use(VueRouter)

const router = new VueRouter({
  mode: 'history',
  routes: [
    {
      path: '/',
      name: 'Home',
      component: homeComponent,
      beforeEnter: (to, from, next) => {
        if (store.state.app.isFirstRun && !isOnboarderVisibleFn()) {
          return next({ name: 'Onboarder' })
        }
        return next()
      },
    },
    {
      path: '/obs/gallery',
      name: 'Gallery',
      component: Gallery,
    },
    {
      path: '/obs/species',
      name: 'Species',
      component: Species,
    },
    {
      path: '/news',
      name: 'News',
      component: News,
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
      path: `/obs/:id(\\d+|${uuidRegex})/edit`,
      name: 'ObsEdit',
      component: SingleSpecies,
      beforeEnter: function(to, from, next) {
        const selectedMethod = 'existing'
        store.commit('ephemeral/resetCoordsState', selectedMethod)
        store.commit('ephemeral/resetDatetimeState', selectedMethod)
        const promise = resolveObsByIdOrNotFound(to, from, next)
        store.commit('ephemeral/setRouterNavPromise', promise)
      },
      meta: {
        isEdit: true,
      },
    },
    {
      path: '/obs/new',
      name: 'ObsNewSingleSpecies',
      component: SingleSpecies,
      beforeEnter: function(to, from, next) {
        const selectedMethod = 'photo'
        store.commit('ephemeral/resetCoordsState', selectedMethod)
        store.commit('ephemeral/resetDatetimeState', selectedMethod)
        store.commit('ephemeral/setRouterNavPromise', Promise.resolve())
        return next()
      },
      meta: {
        isEdit: false,
      },
    },
    {
      path: onboarderPath,
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
      path: '/search',
      name: 'Search',
      component: Search,
    },
    {
      path: '/missions',
      name: 'Missions',
      component: Missions,
    },
    {
      path: '/missions/new',
      name: 'MissionsNew',
      component: MissionsNew,
      meta: {
        isEdit: false,
      },
    },
    {
      path: '/missions/:id(\\d+)/edit',
      name: 'MissionsEdit',
      component: MissionsNew,
      meta: {
        isEdit: true,
      },
    },
    {
      path: '/zzadmin',
      name: 'Admin',
      component: Admin,
    },
    {
      path: '/bug-report',
      name: 'BugReport',
      component: BugReport,
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
  if (store.state.ephemeral.isHelpModalVisible) {
    // make the back button close the help modal
    store.commit('ephemeral/hideHelpModal')
    return next(false)
  }
  if (store.state.ephemeral.previewedPhoto) {
    // make the back button close the photo preview modal
    store.commit('ephemeral/closePhotoPreview')
    return next(false)
  }
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
  return next()
})

router.afterEach((to, from) => {
  // We're doing this stack replace song and dance for the sake of sane nested
  // routing. For example, assume a user lands directly on (or refreshes the
  // page of) the url /foo/bar. When they press the back button, we want them
  // to go somewhere that makes sense. That's up the tree, so we want to go to
  // /foo. The matchedComponents will be an array of all the matches down the
  // routing tree.
  const matchedComponents = to.matched.map(m => m.components.default)
  const isNoMatches = !matchedComponents.length
  if (isNoMatches) {
    console.error(
      `Tried to navigate from (name=${from.name}, path=${from.path}) to ` +
        `route (name=${to.name}, path=${to.path}) that does not exist, ` +
        `defaulting to home`,
    )
    matchedComponents.push(homeComponent)
  }
  mainStackReplace(matchedComponents)
})

async function resolveObsByIdOrNotFound(to, from, next) {
  const wowId = isNaN(to.params.id) ? to.params.id : parseInt(to.params.id)
  try {
    const uuid = await (async function() {
      if (!wowId) {
        return wowId
      }
      const isNotNumber = typeof wowId !== 'number'
      if (isNotNumber) {
        // it's a UUID
        return wowId
      }
      try {
        return await store.dispatch('obs/inatIdToUuid', wowId)
      } catch (err) {
        console.warn(`Could not find UUID for inatId=${wowId}`)
        return null // we'll handle the "not found"-ness later
      }
    })()
    store.commit('obs/setSelectedObservationUuid', uuid)
    if (!store.getters['obs/observationDetail']) {
      console.warn(`Could not find obs record for wowId=${wowId}`)
      return next({ name: 'NotFound', query: { failedUrl: to.fullPath } })
    }
    return next()
  } catch (err) {
    store.dispatch('flagGlobalError', {
      userMsg: 'Failed to navigate to that page',
      msg: `Failed to resolve wowId=${wowId} during nav`,
      err,
    })
    const matchedComponents = from.matched.map(m => m.components.default)
    const isNoMatches = !matchedComponents.length
    if (isNoMatches) {
      wowWarnHandler(
        `Tried to reject navigation and send user back to route ` +
          `(name=${from.name}, path=${from.path}) but could not find Vue ` +
          `components for route, defaulting to home`,
      )
      matchedComponents.push(homeComponent)
    }
    mainStackReplace(matchedComponents)
    return next(false)
  }
}

export default router
