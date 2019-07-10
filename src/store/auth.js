import { isNil } from 'lodash'
import PkceGenerator from 'pkce-challenge'

const lsKeyCodeChallenge = 'wow_code_challenge'
const lsKeyCodeVerifier = 'wow_code_verifier'
const lsKeyInatToken = 'wow_inat_token'
const lsKeyInatTokenType = 'wow_inat_token_type'
const lsKeyInatTokenCreatedAt = 'wow_inat_token_created_at'
const lsKeyInatApiToken = 'wow_inat_api_token'

export default {
  namespaced: true,
  state: {
    token: null,
    tokenType: null,
    tokenCreatedAt: null,
    apiToken: null,
    code_challenge: null,
    code_verifier: null,
  },
  mutations: {
    setToken: (state, value) => {
      state.token = value
      localStorage.setItem(lsKeyInatToken, value)
    },
    setTokenType: (state, value) => {
      state.tokenType = value
      localStorage.setItem(lsKeyInatTokenType, value)
    },
    setTokenCreatedAt: (state, value) => {
      state.tokenCreatedAt = value
      localStorage.setItem(lsKeyInatTokenCreatedAt, value)
    },
    setApiToken: (state, value) => {
      state.apiToken = value
      localStorage.setItem(lsKeyInatApiToken, value)
    },
    setCodeChallenge: (state, value) => (state.code_challenge = value),
    setCodeVerifier: (state, value) => (state.code_verifier = value),
  },
  getters: {
    isUserLoggedIn: state => !isNil(state.token), // FIXME check if expired, does it expire?
  },
  actions: {
    init({ commit }) {
      const valuesToLoad = {
        [lsKeyCodeChallenge]: 'setCodeChallenge',
        [lsKeyCodeVerifier]: 'setCodeVerifier',
        [lsKeyInatToken]: 'setToken',
        [lsKeyInatTokenType]: 'setTokenType',
        [lsKeyInatTokenCreatedAt]: 'setTokenCreatedAt',
        [lsKeyInatApiToken]: 'setApiToken',
      }
      for (const currKey of Object.keys(valuesToLoad)) {
        const commitName = valuesToLoad[currKey]
        loadFromLocalStorageIfPresent(currKey, commitName, commit)
      }
    },
    generatePkcePair({ commit }) {
      const pair = PkceGenerator()
      commit('setCodeChallenge', pair.code_challenge)
      localStorage.setItem(lsKeyCodeChallenge, pair.code_challenge)
      commit('setCodeVerifier', pair.code_verifier)
      localStorage.setItem(lsKeyCodeVerifier, pair.code_verifier)
    },
  },
}

function loadFromLocalStorageIfPresent(key, commitName, commit) {
  const val = localStorage.getItem(key)
  if (isNil(val)) {
    console.debug(`No value in localStorage for key='${key}'`)
    return
  }
  console.debug(`Found value='${val}' in localStorage for key='${key}'`)
  commit(commitName, val)
}
