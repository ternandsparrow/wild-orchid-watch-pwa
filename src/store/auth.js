import { isNil } from 'lodash'
import { createNewUserFromFirebaseAuthUser } from '@/misc/helpers'
import UsersDB from '@/firebase/users-db'

export default {
  namespaced: true,
  state: {
    user: undefined,
  },
  mutations: {
    setUser: (state, value) => (state.user = value),
  },
  actions: {
    /**
     * Callback fired when user login
     */
    login: async ({ commit, dispatch }, firebaseAuthUser) => {
      const userFromFirebase = await new UsersDB().read(firebaseAuthUser.uid)

      const user = isNil(userFromFirebase)
        ? await createNewUserFromFirebaseAuthUser(firebaseAuthUser)
        : userFromFirebase

      commit('setUser', user)
      dispatch('products/getUserProducts', null, { root: true })
    },

    /**
     * Callback fired when user logout
     */
    logout: ({ commit }) => {
      commit('setUser', null)

      // FIXME figure out how to handle login/out
      // const currentRouter = router.app.$route
      // if (!(currentRouter.meta && currentRouter.meta.authNotRequired)) {
      //   router.push('/login')
      // }
    },
  },
  getters: {
    isUserLoggedIn: state => !isNil(state.user),
  },
}
