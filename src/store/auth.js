import { isNil } from 'lodash'
import PkceGenerator from 'pkce-challenge'
import jwt from 'jsonwebtoken'

import {
  apiUrlBase,
  appId,
  inatUrlBase,
  noProfilePicPlaceholderUrl,
  redirectUri,
} from '@/misc/constants'
import {
  chainedError,
  getJsonWithAuth,
  postJsonWithAuth,
  postFormDataWithAuth,
} from '@/misc/helpers'

let updateApiTokenPromise = null

// you should only dispatch doLogin() and saveToken() as an
// external user, don't commit directly.

export default {
  namespaced: true,
  state: {
    token: null,
    tokenType: null,
    tokenCreatedAt: null,
    apiToken: null,
    code_challenge: null,
    code_verifier: null,
    userDetails: {},
  },
  mutations: {
    _setToken: (state, value) => {
      state.token = value
    },
    _setTokenType: (state, value) => {
      state.tokenType = value
    },
    _setTokenCreatedAt: (state, value) => {
      state.tokenCreatedAt = value
    },
    _setApiToken: (state, value) => {
      state.apiToken = value
    },
    _setCodeChallenge: (state, value) => {
      state.code_challenge = value
    },
    _setCodeVerifier: (state, value) => {
      state.code_verifier = value
    },
    _saveUserDetails: (state, value) => {
      state.userDetails = value
    },
  },
  getters: {
    isUserLoggedIn: (state, getters) => {
      return !isNil(state.token) && !isNil(getters.myUserId)
    },
    userEmail(state) {
      const result = state.userDetails.email
      return result ? result : '(no email stored)'
    },
    userIcon(state) {
      const result = state.userDetails.icon
      return result ? inatUrlBase + result : noProfilePicPlaceholderUrl
    },
    myUserId(state) {
      return state.userDetails.id
    },
  },
  actions: {
    async doApiGet({ state, dispatch }, { urlSuffix }) {
      try {
        await dispatch('_refreshApiTokenIfRequired')
        const resp = await getJsonWithAuth(
          `${apiUrlBase}${urlSuffix}`,
          `${state.apiToken}`,
        )
        return resp
      } catch (err) {
        // TODO if we get a 401, could refresh token and retry
        throw chainedError(
          `Failed to make GET to API with URL suffix='${urlSuffix}'`,
          err,
        )
      }
    },
    async doInatGet({ state }, { urlSuffix }) {
      try {
        if (!state.token || !state.tokenType) {
          throw new Error(
            'iNat token or token type is NOT present, cannot continue',
          )
        }
        const resp = await getJsonWithAuth(
          `${inatUrlBase}${urlSuffix}`,
          `${state.tokenType} ${state.token}`,
        )
        return resp
      } catch (err) {
        throw chainedError(
          `Failed to make GET to iNat with URL suffix='${urlSuffix}'`,
          err,
        )
      }
    },
    async doInatPost({ state }, { urlSuffix, data }) {
      try {
        if (!state.token || !state.tokenType) {
          throw new Error(
            'iNat token or token type is NOT present, cannot continue',
          )
        }
        const resp = await postJsonWithAuth(
          `${inatUrlBase}${urlSuffix}`,
          data,
          `${state.tokenType} ${state.token}`,
        )
        return resp
      } catch (err) {
        throw chainedError(
          `Failed to make POST to iNat with URL suffix='${urlSuffix}'`,
          err,
        )
      }
    },
    async doApiPost({ state, dispatch }, { urlSuffix, data }) {
      try {
        await dispatch('_refreshApiTokenIfRequired')
        const resp = await postJsonWithAuth(
          `${apiUrlBase}${urlSuffix}`,
          data,
          `${state.apiToken}`,
        )
        return resp
      } catch (err) {
        // TODO if we get a 401, could refresh token and retry
        throw chainedError(
          `Failed to make POST to API with URL suffix='${urlSuffix}'`,
          err,
        )
      }
    },
    async doPhotoPost({ state, dispatch }, { obsId, photoBlob }) {
      try {
        await dispatch('_refreshApiTokenIfRequired')
        const resp = await postFormDataWithAuth(
          `${apiUrlBase}/observation_photos`,
          formData => {
            formData.append('observation_photo[observation_id]', obsId)
            formData.append('file', photoBlob)
          },
          `${state.apiToken}`,
        )
        return resp
      } catch (err) {
        // TODO if we get a 401, could refresh token and retry
        throw chainedError(
          `Failed to POST observation photo attached to observation ID='${obsId}'`,
          err,
        )
      }
    },
    saveToken({ commit, dispatch }, vals) {
      commit('_setToken', vals.token)
      commit('_setTokenType', vals.tokenType)
      commit('_setTokenCreatedAt', vals.tokenCreatedAt)
      dispatch('_updateApiToken')
      // FIXME trigger a refresh of all other API calls (my obs, etc) or
      // restructure app with router so that it naturally happens
    },
    async doLogin({ state, dispatch }) {
      await dispatch('_generatePkcePair')
      const challenge = state.code_challenge
      location.assign(
        `${inatUrlBase}/oauth/authorize?
        client_id=${appId}&
        redirect_uri=${redirectUri}&
        code_challenge=${challenge}&
        code_challenge_method=S256&
        response_type=code`.replace(/\s/g, ''),
      )
    },
    async doLogout({ state, dispatch }) {
      try {
        await dispatch('doInatPost', {
          urlSuffix: '/oauth/revoke',
          data: {
            token: state.token,
          },
        })
      } catch (err) {
        throw chainedError('Failed to revoke iNat token while logging out', err)
      }
    },
    _generatePkcePair({ commit }) {
      const pair = PkceGenerator()
      commit('_setCodeChallenge', pair.code_challenge)
      commit('_setCodeVerifier', pair.code_verifier)
    },
    async _updateApiToken({ dispatch }) {
      if (updateApiTokenPromise) {
        // ensure we only make one refresh call
        return updateApiTokenPromise
      }
      updateApiTokenPromise = dispatch('_updateApiTokenImpl')
      return updateApiTokenPromise
    },
    async _updateApiTokenImpl({ commit, dispatch }) {
      try {
        const resp = await dispatch('doInatGet', {
          urlSuffix: '/users/api_token',
        })
        const apiToken = resp.api_token
        commit('_setApiToken', apiToken)
        dispatch('_updateUserDetails')
      } catch (err) {
        const status = err.status
        if (status === 401 || status === 400) {
          // FIXME make sure you keep the user's data that hasn't been uploaded
          // but make them login via iNat OAuth again
          throw new Error(
            `iNat token is not valid (response status=${status}), user must login again`,
          )
        }
        throw chainedError('Failed to get API token using iNat token', err)
      } finally {
        updateApiTokenPromise = null
      }
    },
    /**
     * Updates the copy of the user profile we have stored locally.
     * Will be called everytime we refresh the API token, which at the time
     * of writing is every 24hrs.
     */
    async _updateUserDetails({ commit, dispatch }) {
      try {
        const resp = await dispatch('doApiGet', { urlSuffix: '/users/me' })
        const isWrongNumberOfResults = resp.total_results !== 1
        if (isWrongNumberOfResults) {
          throw new Error(
            `Failed to update user details from inat API, request succeeded ` +
              `but expected result count=1 and got total_results=${
                resp.total_results
              }`,
          )
        }
        commit('_saveUserDetails', resp.results[0])
      } catch (err) {
        dispatch(
          'flagGlobalError',
          { msg: 'Failed to update user details from inat API', err },
          { root: true },
        )
      }
    },
    async _refreshApiTokenIfRequired({ dispatch, state }) {
      if (!state.apiToken) {
        console.debug('No API token found, forcing refresh')
        await dispatch('_updateApiToken')
        return
      }
      const decodedJwt = jwt.decode(state.apiToken)
      const now = new Date().getTime() / 1000
      const fiveMinutes = 5 * 60
      const isTokenExpiredOrCloseTo = now > decodedJwt.exp - fiveMinutes
      if (!isTokenExpiredOrCloseTo) {
        return
      }
      console.debug('API token has (or is close to) expired, refreshing.')
      await dispatch('_updateApiToken')
    },
  },
}
