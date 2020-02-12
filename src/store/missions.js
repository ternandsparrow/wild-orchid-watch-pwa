import * as constants from '@/misc/constants'
import { decodeMissionBody, isWowMissionJournalPost } from '@/misc/helpers'

const state = {
  availableMissions: [],
}

const mutations = {
  setAvailableMissions: (state, value) => (state.availableMissions = value),
}

const actions = {
  async getAvailableMissions({ dispatch, commit }) {
    const baseUrl = '/projects/' + constants.inatProjectSlug + '/posts/'
    const allRawRecords = await dispatch(
      'fetchAllPages',
      { baseUrl, pageSize: 20 },
      { root: true },
    )
    // FIXME can we use {start,stop}_time, place_id/lat/lng, radius, distance
    // in posts for our purposes?
    const allMappedRecords = allRawRecords
      .map(e => {
        try {
          if (!isWowMissionJournalPost(e.body)) {
            return false
          }
          const parsedBody = decodeMissionBody(e.body)
          return parsedBody
        } catch (err) {
          console.debug('Could not parse a mission; ignoring. Error: ', err)
          return false
        }
      })
      .filter(e => !!e)
    commit('setAvailableMissions', allMappedRecords)
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
