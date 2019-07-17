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
  wowErrorHandler,
} from '@/misc/helpers'

// you should only dispatch doLogin() and saveToken() as an
// external user, don't commit directly.

const lsKeyCodeChallenge = 'wow_code_challenge'
const lsKeyCodeVerifier = 'wow_code_verifier'
const lsKeyInatToken = 'wow_inat_token'
const lsKeyInatTokenType = 'wow_inat_token_type'
const lsKeyInatTokenCreatedAt = 'wow_inat_token_created_at'
const lsKeyInatApiToken = 'wow_inat_api_token'
const lsKeyUserDetails = 'wow_user_details'

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
      saveToLocalStorage(lsKeyInatToken, value)
    },
    _setTokenType: (state, value) => {
      state.tokenType = value
      saveToLocalStorage(lsKeyInatTokenType, value)
    },
    _setTokenCreatedAt: (state, value) => {
      state.tokenCreatedAt = value
      saveToLocalStorage(lsKeyInatTokenCreatedAt, value)
    },
    _setApiToken: (state, value) => {
      state.apiToken = value
      saveToLocalStorage(lsKeyInatApiToken, value)
    },
    _setCodeChallenge: (state, value) => {
      state.code_challenge = value
      saveToLocalStorage(lsKeyCodeChallenge, value)
    },
    _setCodeVerifier: (state, value) => {
      state.code_verifier = value
      saveToLocalStorage(lsKeyCodeVerifier, value)
    },
    _saveUserDetails: (state, value) => {
      state.userDetails = value
      saveToLocalStorage(lsKeyUserDetails, value)
    },
  },
  getters: {
    isUserLoggedIn: state => !isNil(state.token), // FIXME check if expired, does it expire?
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
    init({ commit }) {
      const valuesToLoad = {
        [lsKeyCodeChallenge]: '_setCodeChallenge',
        [lsKeyCodeVerifier]: '_setCodeVerifier',
        [lsKeyInatToken]: '_setToken',
        [lsKeyInatTokenType]: '_setTokenType',
        [lsKeyInatTokenCreatedAt]: '_setTokenCreatedAt',
        [lsKeyInatApiToken]: '_setApiToken',
        [lsKeyUserDetails]: '_saveUserDetails',
      }
      // FIXME look for a "partial" situation where we have some, but not all details. Then fix it
      for (const currKey of Object.keys(valuesToLoad)) {
        const commitName = valuesToLoad[currKey]
        loadFromLocalStorageIfPresent(currKey, commitName, commit)
      }
    },
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
        wowErrorHandler(
          `Failed to make POST to API with URL suffix='${urlSuffix}'`,
          err,
        )
        // FIXME should we re-throw so callers don't have to check the resp?
        return
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
        wowErrorHandler(
          `Failed to POST observation photo attached to observation ID='${obsId}'`,
          err,
        )
        // FIXME should we re-throw so callers don't have to check the resp?
        return
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
    _generatePkcePair({ commit }) {
      const pair = PkceGenerator()
      commit('_setCodeChallenge', pair.code_challenge)
      commit('_setCodeVerifier', pair.code_verifier)
    },
    async _updateApiToken({ commit, state, dispatch }) {
      try {
        if (!state.token) {
          console.debug(
            'iNat token is not present, cannot request an API token',
          )
          return
        }
        // FIXME extract to doInatGet() action
        const resp = await getJsonWithAuth(
          `${inatUrlBase}/users/api_token`,
          `${state.tokenType} ${state.token}`,
        )
        const apiToken = resp.api_token
        commit('_setApiToken', apiToken)
        dispatch('_updateUserDetails')
      } catch (err) {
        wowErrorHandler('Failed to get API token using iNat token', err)
        return
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
        wowErrorHandler('Failed to update user details from inat API', err)
        return
      }
    },
    async _refreshApiTokenIfRequired({ dispatch, state }) {
      if (!state.apiToken) {
        console.debug('No API token found, forcing refresh')
        dispatch('_updateApiToken')
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
      dispatch('_updateApiToken')
    },
  },
}

function loadFromLocalStorageIfPresent(key, commitName, commit) {
  const val = localStorage.getItem(key)
  if (isNil(val)) {
    console.debug(`No value in localStorage for key='${key}'`)
    return
  }
  const deserialisedVal = JSON.parse(val)
  const debugFriendlyVal =
    ('' + val).length > 100 ? val.substr(0, 100) + '...' : val
  console.debug(
    `Found value='${debugFriendlyVal}' in localStorage for key='${key}'`,
  )
  commit(commitName, deserialisedVal)
}

function saveToLocalStorage(key, value) {
  const serialisedVal = JSON.stringify(value)
  localStorage.setItem(key, serialisedVal)
}
