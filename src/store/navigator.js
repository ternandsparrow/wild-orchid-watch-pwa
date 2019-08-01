import Observations from '@/pages/obs/index'
import {
  onboarderComponentName,
  oauthCallbackComponentName,
} from '@/misc/constants'

// Note that this whole module will be ignored by vuex-persistedstate because
// we intercept the "save state" operation and strip it out before writing. So,
// two rules:
//   1. put all your Onsen navigator related stuff in this module
//   2. don't add Vue Components to the Vuex store anywhere else, expect here

export default {
  strict: true,
  namespaced: true,
  state: {
    stack: [],
    options: {},
    innerPageStack: [Observations],
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
    pushInnerPage(state, value) {
      state.innerPageStack = [value]
    },
  },
  getters: {
    pageStack(state) {
      return state.stack
    },
    isOnboarderVisible(state) {
      return isTopOfStack(state.stack, onboarderComponentName)
    },
    isOauthCallbackVisible(state) {
      return isTopOfStack(state.stack, oauthCallbackComponentName)
    },
  },
}

function isTopOfStack(stack, componentName) {
  return stack && stack.length && stack[stack.length - 1].name === componentName
}
