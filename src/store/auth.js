import { isNil } from 'lodash'

export default {
  namespaced: true,
  state: {
    user: undefined,
  },
  mutations: {
    setUser: (state, value) => (state.user = value),
  },
  actions: {
    // login: async ({ commit, dispatch }, authUser) => {
    //   // FIXME get details for iNat user
    //   commit('setUser', user)
    // },
    // logout: ({ commit }) => {
    //   commit('setUser', null)
    // },
  },
  getters: {
    isUserLoggedIn: state => !isNil(state.user),
  },
}
