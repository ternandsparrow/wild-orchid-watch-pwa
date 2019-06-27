import {isNil} from 'lodash'

export default {
  namespaced: true,
  state: {
    token: null,
    tokenType: null,
  },
  mutations: {
    setToken: (state, value) => (state.token = value),
    setTokenType: (state, value) => (state.tokenType = value),
  },
  getters: {
    isUserLoggedIn: (state) => !isNil(state.token), // FIXME check if expired, does it expire?
  },
}
