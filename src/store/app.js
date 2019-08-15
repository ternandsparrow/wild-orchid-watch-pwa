import { alwaysUpload } from '@/misc/constants'
import { chainedError, getJson } from '@/misc/helpers'

const state = {
  appTitle: process.env.VUE_APP_TITLE,
  isFirstRun: true, // remember we restore state from localStorage, so this is default
  topTitle: 'Wild Orchid Watch',
  tsAndCsAccepted: false,
  whenToUpload: alwaysUpload,
  runtimeConfig: null,
}

const mutations = {
  setTopTitle: (state, value) => (state.topTitle = value),
  setIsFirstRun: (state, value) => (state.isFirstRun = value),
  setTsAndCsAccepted: (state, value) => (state.tsAndCsAccepted = value),
  setWhenToUpload: (state, value) => (state.whenToUpload = value),
  setRunTimeConfig: (state, value) => (state.runtimeConfig = value),
}

const actions = {
  async refreshRuntimeConfig({ commit }) {
    try {
      const resp = await getJson('/runtime-config.json') // assume served from root
      commit('setRunTimeConfig', resp)
    } catch (err) {
      throw chainedError('Failed to GET runtime config', err)
    }
  },
}
const getters = {}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
}
