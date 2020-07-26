import * as constants from '@/misc/constants'
import {
  buildStaleCheckerFn,
  decodeMissionBody,
  isWowMissionJournalPost,
  now,
} from '@/misc/helpers'

const state = {
  allJournalPosts: [],
  allJournalPostsLastUpdated: 0,
  availableMissions: [],
  identificationSuggestions: [], // FIXME only get last N days of these?
  projectUpdates: [],
}

const mutations = {
  setAvailableMissions: (state, value) => (state.availableMissions = value),
  setIdentificationSuggestions: (state, value) =>
    (state.identificationSuggestions = value),
  setProjectUpdates: (state, value) => (state.projectUpdates = value),
  setAllJournalPosts: (state, value) => {
    state.allJournalPosts = value
    state.allJournalPostsLastUpdated = now()
  },
}

const actions = {
  async refreshProjectJournal({ dispatch, commit, getters }) {
    if (!getters.isProjectPostsStale) {
      return
    }
    const baseUrl = '/projects/' + constants.inatProjectSlug + '/posts/'
    const allRawRecords = await dispatch(
      'fetchAllPages',
      {
        baseUrl,
        pageSize: constants.obsPageSize,
      },
      { root: true },
    )
    commit('setAllJournalPosts', allRawRecords)
  },
  async getAvailableMissions({ state, dispatch, commit }) {
    await dispatch('refreshProjectJournal')
    // FIXME can we use {start,stop}_time, place_id/lat/lng, radius, distance
    // in posts for our purposes?
    const allMappedRecords = state.allJournalPosts
      .map(e => {
        try {
          if (!isWowMissionJournalPost(e.body)) {
            return false
          }
          const parsedBody = decodeMissionBody(e.body)
          return {
            ...parsedBody,
            id: e.id,
          }
        } catch (err) {
          console.debug('Could not parse a mission; ignoring. Error: ', err)
          return false
        }
      })
      .filter(e => !!e)
    commit('setAvailableMissions', allMappedRecords)
  },
  async deleteMission({ dispatch }, missionId) {
    const url = '/posts/' + missionId
    return dispatch(
      'doApiDelete',
      { urlSuffix: url, recordUuid: null },
      { root: true },
    )
  },
  async updateIdentificationSuggestions({ commit }) {
    // FIXME remove and do it for real
    const records = [
      // {
      //   id: 1,
      //   user: 'user1',
      //   action: 'suggested an ID: Red-banded Greenhood',
      //   timeStr: '1w',
      //   type: 'wowIdentification',
      //   photoUrl:
      //     constants.inatStaticUrlBase +
      //     '/photos/41817887/square.jpeg?1560430573',
      // },
    ]
    commit('setIdentificationSuggestions', records)
  },
  async updateProjectUpdates({ commit, dispatch, state }) {
    await dispatch('refreshProjectJournal')
    const allMappedRecords = state.allJournalPosts
      .map(e => {
        try {
          if (isWowMissionJournalPost(e.body)) {
            return false
          }
          return {
            author: e.user.login,
            body: e.body,
            createdAt: e.created_at,
            id: e.id,
            publishedAt: e.published_at,
            type: 'wowNews',
            updatedAt: e.updated_at,
          }
        } catch (err) {
          console.debug(
            'Could not process a journal post; ignoring. Error: ',
            err,
          )
          return false
        }
      })
      .filter(e => !!e)
    commit('setProjectUpdates', allMappedRecords)
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
  isProjectPostsStale: buildStaleCheckerFn('allJournalPostsLastUpdated', 10),
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
