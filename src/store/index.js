import Vue from 'vue'
import Vuex from 'vuex'
import createPersistedState from 'vuex-persistedstate'

import auth from './auth'
import app from './app'
import ephemeral from './ephemeral'
import obs, { apiTokenHooks as obsApiTokenHooks } from './obs'
import activity from './activity'
import missions from './missions'
import { wowErrorHandler } from '@/misc/helpers'
import { neverUpload, persistedStateLocalStorageKey } from '@/misc/constants'

Vue.use(Vuex)

const store = new Vuex.Store({
  strict: process.env.NODE_ENV !== 'production',
  plugins: [
    createPersistedState({
      key: persistedStateLocalStorageKey,
      setState: (key, state, storage) => {
        const cleanedState = Object.assign({}, state)
        // don't save anything in the ephemeral module, we assume nothing in
        // here will serialise or should be saved.
        delete cleanedState.ephemeral
        return storage.setItem(key, JSON.stringify(cleanedState))
      },
    }),
  ],
  state: {
    isGlobalErrorState: false,
  },
  mutations: {
    _flagGlobalError: state => (state.isGlobalErrorState = true),
  },
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
    flagGlobalError({ commit }, { msg, err }) {
      commit('_flagGlobalError')
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
      return !getters['isUploadsDisabled']
    },
    isUploadsDisabled(state) {
      return state.app.whenToUpload === neverUpload
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

const allApiTokenHooks = [...obsApiTokenHooks]

store.watch(
  state => {
    return state.auth.apiTokenAndUserLastUpdated
  },
  () => {
    console.debug('API Token and user details changed, triggering hooks')
    for (const curr of allApiTokenHooks) {
      curr(store)
    }
  },
)

// FIXME watch "is user logged in" state and if not, trigger the login (and onboarder?)

export default store
