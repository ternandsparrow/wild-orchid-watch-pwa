import Vue from 'vue'
import Vuex from 'vuex'

import auth from './auth'
import app from './app'
import obs from './obs'
import activity from './activity'
import missions from './missions'

Vue.use(Vuex)

export default new Vuex.Store({
  strict: process.env.NODE_ENV !== 'production',
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
    navigator: {
      strict: true,
      namespaced: true,
      state: {
        stack: [],
        options: {},
      },
      mutations: {
        push(state, page) {
          state.stack.push(page)
        },
        pop(state) {
          if (state.stack.length > 1) {
            state.stack.pop()
          }
        },
        replace(state, page) {
          state.stack.pop()
          state.stack.push(page)
        },
        reset(state, page) {
          state.stack = Array.isArray(page) ? page : [page || state.stack[0]]
        },
        options(state, newOptions = {}) {
          state.options = newOptions
        },
      },
      getters: {
        pageStack(state) {
          return state.stack
        },
      },
    },

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
