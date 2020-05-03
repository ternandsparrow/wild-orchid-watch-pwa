import { inatStaticUrlBase } from '@/misc/constants'

const state = {
  // FIXME can we only get the last N days of these?
  identificationSuggestions: [],
  projectUpdates: [],
}

const mutations = {
  setIdentificationSuggestions: (state, value) =>
    (state.identificationSuggestions = value),
  setProjectUpdates: (state, value) => (state.projectUpdates = value),
}

const actions = {
  async updateIdentificationSuggestions({ commit }) {
    // FIXME remove and do it for real
    const records = [
      {
        id: 1,
        user: 'user1',
        action: 'suggested an ID: Red-banded Greenhood',
        timeStr: '1w',
        photoUrl: inatStaticUrlBase + '/photos/41817887/square.jpeg?1560430573',
      },
    ]
    commit('setIdentificationSuggestions', records)
  },
  async updateProjectUpdates({ commit }) {
    // FIXME remove and do it for real
    // FIXME get all project posts here, and change missions to use this
    // but filter down to only mission posts
    const records = []
    commit('setProjectUpdates', records)
  },
  async updateNewsIfRequired({ dispatch }) {
    const isUpdatedRecently = false // FIXME check this with last timestamp
    if (isUpdatedRecently) {
      return
    }
    await Promise.all([
      dispatch('updateIdentificationSuggestions'),
      dispatch('updateProjectUpdates'),
    ])
  },
}
const getters = {
  allNews(state) {
    const result = [...state.identificationSuggestions, ...state.projectUpdates]
    // FIXME sort by date, newest first
    return result
  },
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
}
