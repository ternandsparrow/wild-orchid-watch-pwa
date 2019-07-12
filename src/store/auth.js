import { isNil } from 'lodash'
import PkceGenerator from 'pkce-challenge'

import {
  inatUrlBase,
  appId,
  redirectUri,
  apiUrlBase,
  noProfilePicPlaceholderUrl,
} from '@/misc/constants'
import { getJsonWithAuth } from '@/misc/helpers'

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
    _generatePkcePair({ commit }) {
      const pair = PkceGenerator()
      commit('_setCodeChallenge', pair.code_challenge)
      commit('_setCodeVerifier', pair.code_verifier)
    },
    saveToken({ commit, dispatch }, vals) {
      commit('_setToken', vals.token)
      commit('_setTokenType', vals.tokenType)
      commit('_setTokenCreatedAt', vals.tokenCreatedAt)
      dispatch('_updateApiToken')
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
    async _updateApiToken({ commit, state, dispatch }) {
      try {
        const resp = await getJsonWithAuth(
          `${inatUrlBase}/users/api_token`,
          `${state.tokenType} ${state.token}`,
        )
        const apiToken = resp.api_token
        commit('_setApiToken', apiToken)
        dispatch('_updateUserDetails')
      } catch (err) {
        console.error('Failed to get API token using iNat token', err)
        // FIXME report to rollbar
        return
      }
    },
    async _updateUserDetails({ commit, state }) {
      // FIXME need to trigger this periodcally to looks for profile changes
      try {
        const resp = await getJsonWithAuth(
          `${apiUrlBase}/users/me`,
          `${state.apiToken}`,
        )
        const isWrongNumberOfResults = resp.total_results !== 1
        if (isWrongNumberOfResults) {
          throw new Error(
            `Failed to update user details from inat API, request succeeded but expected result count=1 and got total_results=${
              resp.total_results
            }`,
          )
        }
        commit('_saveUserDetails', resp.results[0])
      } catch (err) {
        console.error('Failed to update user details from inat API', err)
        // FIXME report to rollbar
        return
      }
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
  console.debug(
    `Found value='${deserialisedVal}' in localStorage for key='${key}'`,
  )
  commit(commitName, deserialisedVal)
}

function saveToLocalStorage(key, value) {
  const serialisedVal = JSON.stringify(value)
  localStorage.setItem(key, serialisedVal)
}
