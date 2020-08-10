import Vue from 'vue'
import Vuex from 'vuex'
import createPersistedState from 'vuex-persistedstate'

import {
  neverUpload,
  persistedStateLocalStorageKey,
  isForceVueDevtools,
} from '@/misc/constants'
import { wowErrorHandler, chainedError } from '@/misc/helpers'
import auth from './auth'
import app, { callback as appCallback } from './app'
import ephemeral from './ephemeral'
import obs, {
  apiTokenHooks as obsApiTokenHooks,
  migrate as obsMigrate,
  networkHooks as obsNetworkHooks,
} from './obs'
import missionsAndNews from './missionsAndNews'

if (isForceVueDevtools) {
  Vue.config.devtools = true
}
Vue.use(Vuex)

const store = new Vuex.Store({
  strict: process.env.NODE_ENV !== 'production',
  plugins: [
    createPersistedState({
      key: persistedStateLocalStorageKey,
      setState: (key, state, storage) => {
        const cleanedState = Object.assign({}, state)
        // don't persist anything in the ephemeral module, we assume nothing in
        // it will serialise nicely or should be saved.
        delete cleanedState.ephemeral
        // Jul 2020 migration to remove old namespaces
        delete cleanedState.missions
        delete cleanedState.news
        // Aug 2020 remove fields no longer used
        delete cleanedState.obs.selectedObservationId
        return storage.setItem(key, JSON.stringify(cleanedState))
      },
    }),
  ],
  actions: {
    doApiGet({ dispatch }, argObj) {
      return dispatch('auth/doApiGet', argObj)
    },
    doApiPost({ dispatch }, argObj) {
      return dispatch('auth/doApiPost', argObj)
    },
    doApiPut({ dispatch }, argObj) {
      return dispatch('auth/doApiPut', argObj)
    },
    doPhotoPost({ dispatch }, argObj) {
      return dispatch('auth/doPhotoPost', argObj)
    },
    doLocalPhotoPost({ dispatch }, argObj) {
      return dispatch('auth/doLocalPhotoPost', argObj)
    },
    doApiDelete({ dispatch }, argObj) {
      return dispatch('auth/doApiDelete', argObj)
    },
    flagGlobalError({ commit }, { msg, userMsg, imgUrl, err }) {
      commit('ephemeral/flagGlobalError', {
        msg: userMsg || msg,
        imgUrl,
        isNetworkErrorWow: err.isNetworkErrorWow,
      })
      wowErrorHandler(msg, err)
    },
    async fetchAllPages({ dispatch }, { baseUrl, pageSize }) {
      let isMorePages = true
      let allRecords = []
      let currPage = 1
      while (isMorePages) {
        try {
          console.debug(`Getting page=${currPage} of ${baseUrl}`)
          const isExistingQueryString = ~baseUrl.indexOf('?')
          const joiner = isExistingQueryString ? '&' : '?'
          const urlSuffix = `${baseUrl}${joiner}per_page=${pageSize}&page=${currPage}`
          const resp = await dispatch('doApiGet', { urlSuffix })
          const results = resp.results
          // note: we use the per_page from the resp because if we request too
          // many records per page, the server will ignore our page size and
          // the following check won't work
          isMorePages = results.length === resp.per_page
          allRecords = allRecords.concat(results)
          currPage += 1
        } catch (err) {
          throw chainedError(
            `Failed while trying to get page=${currPage} of ${baseUrl}`,
            err,
          )
        }
      }
      return allRecords
    },
    healthcheck({ dispatch }) {
      return dispatch('obs/healthcheck')
    },
  },
  getters: {
    myUserId(state, getters) {
      return getters['auth/myUserId']
    },
    myLocale(state, getters) {
      return getters['auth/myLocale']
    },
    myPlaceId(state, getters) {
      return getters['auth/myPlaceId']
    },
    isSyncDisabled(state) {
      return state.app.whenToSync === neverUpload
    },
  },
  modules: {
    app,
    auth,
    ephemeral,
    missionsAndNews,
    obs,
  },
})

// make sure all your hooks are async or return promises
const allApiTokenHooks = [...obsApiTokenHooks]

store.watch(
  state => state.auth.apiTokenAndUserLastUpdated,
  () => {
    console.debug('API Token and user details changed, triggering hooks')
    for (const curr of allApiTokenHooks) {
      curr(store).catch(err => {
        store.dispatch(
          'flagGlobalError',
          {
            msg: `Failed while executing an API Token hook`,
            userMsg: `Error encountered while synchronising data with the server`,
            err,
          },
          { root: true },
        )
      })
    }
  },
)

// make sure all your hooks are async or return promises
const allNetworkHooks = [...obsNetworkHooks]

store.watch(
  state => state.ephemeral.networkOnLine,
  () => {
    console.debug('Network on/off-line status changed, triggering hooks')
    for (const curr of allNetworkHooks) {
      curr(store).catch(err => {
        store.dispatch(
          'flagGlobalError',
          {
            msg: `Failed while executing a network on/off-line hook`,
            userMsg: `Error encountered while reconnecting to the server`,
            err,
          },
          { root: true },
        )
      })
    }
  },
)

appCallback(store)

export default store

/**
 * Add any code here that migrates vuex stores on user devices to match what we
 * expect in this version of the codebase.
 */
export function migrateOldStores(store) {
  obsMigrate(store)
}
