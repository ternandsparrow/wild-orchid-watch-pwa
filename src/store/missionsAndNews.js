import { decodeMissionBody, isWowMissionJournalPost } from '@/misc/helpers'
import { getWebWorker } from '@/misc/web-worker-manager'

// consciously *not* keeping this data in the store. FIXME When we move to
// pinia, maybe we can make sure this data isn't always loaded and slowing
// things down.

const actions = {
  async getAllProjectJournal({ dispatch }) {
    const webWorker = getWebWorker()
    const apiToken = await dispatch('auth/getApiToken', null, { root: true })
    const result = await webWorker.getAllJournalPosts(apiToken)
    return result
  },
  async getAvailableMissions({ dispatch }) {
    // FIXME can we use {start,stop}_time, place_id/lat/lng, radius, distance
    // in posts for our purposes?
    const allPosts = await dispatch('getAllProjectJournal')
    const allMappedRecords = allPosts
      .map((e) => {
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
      .filter((e) => !!e)
    return allMappedRecords
  },
  async deleteMission({ dispatch }, missionId) {
    const url = `/posts/${missionId}`
    return dispatch(
      'doApiDelete',
      { urlSuffix: url, recordUuid: null },
      { root: true },
    )
  },
  async getProjectUpdates({ dispatch }) {
    const allPosts = await dispatch('getAllProjectJournal')
    const allMappedRecords = allPosts
      .map((e) => {
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
      .filter((e) => !!e)
    return allMappedRecords
  },
}

export default {
  namespaced: true,
  state: {},
  mutations: {},
  actions,
  getters: {},
}
