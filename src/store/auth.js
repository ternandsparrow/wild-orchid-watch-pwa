import { isNil } from 'lodash'
import PkceGenerator from 'pkce-challenge'
import jwtDecode from 'jwt-decode'
import * as Sentry from '@sentry/browser' // piggybacks on the config done in src/main.js

import * as constants from '@/misc/constants'
import {
  ChainedError,
  deleteWithAuth,
  getJsonWithAuth,
  isNoSwActive,
  now,
  postJsonWithAuth,
  putJsonWithAuth,
  wowWarnHandler,
} from '@/misc/helpers'

let updateApiTokenPromise = null

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
    userDetailsLastUpdated: 0,
    apiTokenAndUserLastUpdated: 0,
    isUpdatingApiToken: false,
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
      state.userDetailsLastUpdated = now()
    },
    markApiTokenAndUserLastUpdated: (state) => {
      state.apiTokenAndUserLastUpdated = now()
    },
    setIsUpdatingApiToken: (state, value) => (state.isUpdatingApiToken = value),
  },
  getters: {
    isUserLoggedIn: (state, getters) => {
      return !isNil(state.token) && !isNil(getters.myUserId)
    },
    userEmail(state) {
      const result = state.userDetails.email
      return result || '(no email stored)'
    },
    userIcon(state) {
      const result = state.userDetails.icon
      return result || constants.noProfilePicPlaceholderUrl
    },
    myUserId(state) {
      return state.userDetails.id
    },
    myUsername(state) {
      return state.userDetails.login
    },
    myLocale(state) {
      return state.userDetails.locale
    },
    myPlaceId(state) {
      return state.userDetails.place_id
    },
  },
  actions: {
    async getApiToken({ state, dispatch }) {
      await dispatch('_refreshApiTokenIfRequired')
      return state.apiToken
    },
    async doApiGet({ state, dispatch }, { urlSuffix }) {
      try {
        await dispatch('_refreshApiTokenIfRequired')
        const resp = await getJsonWithAuth(
          `${constants.apiUrlBase}${urlSuffix}`,
          `${state.apiToken}`,
        )
        return resp
      } catch (err) {
        // TODO if we get a 401, could refresh token and retry
        // TODO handle a 422: unknown user
        throw ChainedError(
          `Failed to make GET to API with URL suffix='${urlSuffix}'`,
          err,
        )
      }
    },
    async doApiDelete({ state, dispatch }, { urlSuffix, recordUuid }) {
      try {
        await dispatch('_refreshApiTokenIfRequired')
        const resp = await deleteWithAuth(
          `${constants.apiUrlBase}${urlSuffix}`,
          `${state.apiToken}`,
          recordUuid,
        )
        return resp
      } catch (err) {
        // TODO if we get a 401, could refresh token and retry
        throw ChainedError(
          `Failed to make DELETE to API with URL suffix='${urlSuffix}'`,
          err,
        )
      }
    },
    assertInatTokenValid({ state, commit }) {
      if (state.token && state.tokenType) {
        return
      }
      // TODO this commit might be redundant as the login message should
      // already be shown. Perhaps we should get more obvious? But then maybe
      // we shouldn't so the user can finish saving the observation locally
      commit('ephemeral/setForceShowLoginToast', true, { root: true }) // TODO remove cross module dependency, use a facade at the root
      // TODO enhancement idea: currently this will trigger the "something
      // broke" message. That's not great UX as we should really only show the
      // login prompt.
      throw new Error(
        'iNat token or token type is NOT present, cannot make call. Forcing user to login again',
      )
    },
    async doInatGet({ state, dispatch }, { urlSuffix }) {
      try {
        dispatch('assertInatTokenValid')
        const resp = await getJsonWithAuth(
          `${constants.inatUrlBase}${urlSuffix}`,
          `${state.tokenType} ${state.token}`,
        )
        return resp
      } catch (err) {
        throw ChainedError(
          `Failed to make GET to iNat with URL suffix='${urlSuffix}'`,
          err,
        )
      }
    },
    async doInatPost({ state, dispatch }, { urlSuffix, data }) {
      try {
        dispatch('assertInatTokenValid')
        const resp = await postJsonWithAuth(
          `${constants.inatUrlBase}${urlSuffix}`,
          data,
          `${state.tokenType} ${state.token}`,
        )
        return resp
      } catch (err) {
        throw ChainedError(
          `Failed to make POST to iNat with URL suffix='${urlSuffix}'` +
            `data='${JSON.stringify(data)}'`,
          err,
        )
      }
    },
    // FIXME need to move core of this outside vuex
    async doApiPost({ state, dispatch }, { urlSuffix, data }) {
      try {
        await dispatch('_refreshApiTokenIfRequired')
        const resp = await postJsonWithAuth(
          `${constants.apiUrlBase}${urlSuffix}`,
          data,
          `${state.apiToken}`,
        )
        return resp
      } catch (err) {
        // TODO if we get a 401, could refresh token and retry
        throw ChainedError(
          `Failed to make POST to API with URL suffix='${urlSuffix}' and ` +
            `data='${JSON.stringify(data)}'`,
          err,
        )
      }
    },
    async doApiPut({ state, dispatch }, { urlSuffix, data }) {
      try {
        await dispatch('_refreshApiTokenIfRequired')
        const resp = await putJsonWithAuth(
          `${constants.apiUrlBase}${urlSuffix}`,
          data,
          `${state.apiToken}`,
        )
        return resp
      } catch (err) {
        // TODO if we get a 401, could refresh token and retry
        throw ChainedError(
          `Failed to make PUT to API with URL suffix='${urlSuffix}' and ` +
            `data='${JSON.stringify(data)}'`,
          err,
        )
      }
    },
    saveToken({ commit, dispatch }, vals) {
      // note: we're setting the *iNat* token here, the API token is different
      commit('_setToken', vals.token)
      commit('_setTokenType', vals.tokenType)
      commit('_setTokenCreatedAt', vals.tokenCreatedAt)
      dispatch('_updateApiToken')
    },
    async doLogin({ state, dispatch }) {
      await dispatch('_generatePkcePair')
      const challenge = state.code_challenge
      await dispatch('_assertReadyForOauthCallback')
      window.location.assign(
        `${constants.inatUrlBase}/oauth/authorize?
        client_id=${constants.appId}&
        redirect_uri=${constants.redirectUri}&
        code_challenge=${challenge}&
        code_challenge_method=S256&
        response_type=code`.replace(/\s/g, ''),
      )
    },
    _assertReadyForOauthCallback({ state }) {
      const cc = state.code_challenge
      const cv = state.code_verifier
      const isPkceValsGenerated = cc && cv
      if (!isPkceValsGenerated) {
        const msg =
          'Some, or all, PKCE values are missing from vuex: ' +
          `code_challenge='${cc}', code_verifier=${cv}`
        wowWarnHandler(msg)
        return
      }
      const persistedStore = JSON.parse(
        localStorage.getItem(constants.persistedStateLocalStorageKey) || '{}',
      )
      const persistedCc = persistedStore.auth.code_challenge
      const persistedCv = persistedStore.auth.code_verifier
      const isPkceValsMirroredInLocalStorage = persistedCc && persistedCv
      if (!isPkceValsMirroredInLocalStorage) {
        const msg =
          'Some, or all, PKCE values are missing from localStorage mirror: ' +
          `code_challenge='${persistedCc}', code_verifier=${persistedCv}`
        wowWarnHandler(msg)
        return
      }
      console.debug('PKCE values all look good to go!')
    },
    async doLogout({ state, dispatch }) {
      if (!state.token) {
        console.debug('No stored iNat token so no need to perform iNat logout')
        return
      }
      try {
        await dispatch('doInatPost', {
          urlSuffix: '/oauth/revoke',
          data: {
            token: state.token,
          },
        })
        // We do NOT automatically logout of iNat on behalf of the user. It's
        // not our place to do so as iNat is it's own separate service. Imagine
        // if you logged out of something that used Google OAuth and suddenly
        // you're logged out of all Google services... yeah, not good. Thanks
        // to https://stackoverflow.com/a/12909563/1410035 for the primer on
        // this.
      } catch (err) {
        throw ChainedError('Failed to revoke iNat token while logging out', err)
      }
    },
    _generatePkcePair({ commit }) {
      const pair = PkceGenerator()
      commit('_setCodeChallenge', pair.code_challenge)
      commit('_setCodeVerifier', pair.code_verifier)
    },
    async _updateApiToken({ commit, dispatch }) {
      if (updateApiTokenPromise) {
        // ensure we only make one refresh call
        return updateApiTokenPromise
      }
      updateApiTokenPromise = impl()
      return updateApiTokenPromise
      async function impl() {
        try {
          const resp = await dispatch('doInatGet', {
            urlSuffix: '/users/api_token',
          })
          const apiToken = resp.api_token
          commit('_setApiToken', apiToken)
          dispatch('updateUserDetails').then(() => {
            commit('markApiTokenAndUserLastUpdated')
            commit('setIsUpdatingApiToken', false)
          })
        } catch (err) {
          commit('setIsUpdatingApiToken', false)
          const status = err.httpStatus
          if (status === 401 || status === 400) {
            commit('_setToken', null) // triggers the toast to login again
            return
          }
          throw ChainedError('Failed to get API token using iNat token', err)
        } finally {
          updateApiTokenPromise = null
        }
      }
    },
    /**
     * Updates the copy of the user profile we have stored locally.
     * Will be called everytime we refresh the API token, which at the time
     * of writing is every 24hrs.
     */
    async updateUserDetails({ commit, dispatch }) {
      try {
        const resp = await dispatch('doApiGet', { urlSuffix: '/users/me' })
        const isWrongNumberOfResults = resp.total_results !== 1
        if (isWrongNumberOfResults) {
          throw new Error(
            `Failed to update user details from inat API, request succeeded ` +
              `but expected result count=1 and got total_results=${resp.total_results}`,
          )
        }
        commit('_saveUserDetails', resp.results[0])
        dispatch('setUsernameOnSentry')
      } catch (err) {
        dispatch(
          'flagGlobalError',
          { msg: 'Failed to update user details from inat API', err },
          { root: true },
        )
      }
    },
    setUsernameOnSentry({ getters, dispatch }) {
      const username = getters.myUsername
      if (!username) {
        console.debug('No username present, cannot set on Sentry')
        return
      }
      console.debug(`Setting username=${username} on Sentry`)
      Sentry.configureScope((scope) => {
        scope.setUser({ username })
      })
      dispatch('sendSwUpdatedErrorTrackerContext', { username })
    },
    async sendSwUpdatedErrorTrackerContext(_, { username }) {
      if (await isNoSwActive()) {
        return
      }
      return fetch(constants.serviceWorkerUpdateErrorTrackerContextUrl, {
        method: 'POST',
        retries: 0,
        body: JSON.stringify({
          username,
        }),
      })
    },
    async _refreshApiTokenIfRequired({ dispatch, state }) {
      if (!state.apiToken) {
        console.debug('No API token found, forcing refresh')
        await dispatch('_updateApiToken')
        return
      }
      try {
        const decodedJwt = jwtDecode(state.apiToken)
        const nowSeconds = new Date().getTime() / 1000
        const fiveMinutes = 5 * 60
        const isTokenExpiredOrCloseTo =
          nowSeconds > decodedJwt.exp - fiveMinutes
        if (!isTokenExpiredOrCloseTo) {
          return
        }
        console.debug('API token has (or is close to) expired, refreshing.')
        await dispatch('_updateApiToken')
      } catch (err) {
        wowWarnHandler(
          `Error while decoding JWT, assuming it's malformed so doing an update`,
          err,
        )
        await dispatch('_updateApiToken')
      }
    },
  },
}
