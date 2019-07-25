import Vue from 'vue'
import Vuex from 'vuex'
import createPersistedState from 'vuex-persistedstate'

import auth from './auth'
import app from './app'
import obs from './obs'
import activity from './activity'
import missions from './missions'
import navigator from './navigator'
import { wowErrorHandler } from '@/misc/helpers'

Vue.use(Vuex)

export default new Vuex.Store({
  strict: process.env.NODE_ENV !== 'production',
  plugins: [
    createPersistedState({
      key: 'wow-vuex',
      setState: (key, state, storage) => {
        // Don't store Onsen navigator state!
        // Vue components don't serialise well, mainly due the fact they
        // contain functions. Even if they did, we probably don't want to
        // restore them. If we want to restore the user's nav state then we
        // should find another way
        const cleanedState = Object.assign({}, state)
        delete cleanedState.navigator
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
    doPhotoPost({ dispatch }, argObj) {
      return dispatch('auth/doPhotoPost', argObj)
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
  },
  modules: {
    auth,
    app,
    obs,
    activity,
    missions,
    navigator,
    splitter: {
      strict: true,
      namespaced: true,
      state: {
        open: false,
      },
      mutations: {
        toggle(state, shouldOpen) {
          if (typeof shouldOpen === 'boolean') {
            state.open = shouldOpen
          } else {
            state.open = !state.open
          }
        },
      },
    },
  },
})
