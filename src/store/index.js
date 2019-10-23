import Vue from 'vue'
import Vuex from 'vuex'
import createPersistedState from 'vuex-persistedstate'

import auth from './auth'
import app, { callback as appCallback } from './app'
import ephemeral from './ephemeral'
import obs, {
  apiTokenHooks as obsApiTokenHooks,
  migrate as obsMigrate,
  networkHooks as obsNetworkHooks,
} from './obs'
import activity from './activity'
import missions from './missions'
import { wowErrorHandler } from '@/misc/helpers'
import {
  neverUpload,
  persistedStateLocalStorageKey,
  beginner,
} from '@/misc/constants'

Vue.use(Vuex)

const store = new Vuex.Store({
  strict: process.env.NODE_ENV !== 'production',
  plugins: [
    createPersistedState({
      key: persistedStateLocalStorageKey,
      setState: (key, state, storage) => {
        // don't save anything in the ephemeral module, we assume nothing in
        // here will serialise or should be saved.
        const whitelistKeys = Object.keys(state).filter(k => k !== 'ephemeral')
        return storage.setItem(key, JSON.stringify(state, whitelistKeys))
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
    doApiDelete({ dispatch }, argObj) {
      return dispatch('auth/doApiDelete', argObj)
    },
    flagGlobalError({ commit }, { msg, userMsg, err }) {
      commit('ephemeral/flagGlobalError', userMsg)
      wowErrorHandler(msg, err)
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
    canUploadNow(state, getters) {
      // TODO when we support "only on WiFi", we'll need to check the current
      // connection type
      return !getters['isSyncDisabled']
    },
    isSyncDisabled(state) {
      return state.app.whenToSync === neverUpload
    },
    isInBeginnerMode(state) {
      return state.app.userMode === beginner
    },
  },
  modules: {
    activity,
    app,
    auth,
    ephemeral,
    missions,
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
