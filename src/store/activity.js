import { inatStaticUrlBase } from '@/misc/constants'

const state = {
  myEvents: [],
  followingEvents: [],
  tabIndex: 0,
}

const mutations = {
  setMyEvents: (state, value) => (state.myEvents = value),
  setFollowingEvents: (state, value) => (state.followingEvents = value),
  setTab: (state, value) => (state.tabIndex = value),
}

const actions = {
  async getMyEvents({ commit }) {
    // FIXME remove and do it for real
    commit('setMyEvents', [])
    const records = [
      {
        id: 1,
        user: 'user1',
        action: 'suggested an ID: Red-banded Greenhood',
        timeStr: '1w',
        photoUrl: inatStaticUrlBase + '/photos/41817887/square.jpeg?1560430573',
      },
    ]
    commit('setMyEvents', records)
  },
  async getFollowingEvents({ commit }) {
    // FIXME remove and do it for real
    commit('setFollowingEvents', [])
    const records = []
    commit('setFollowingEvents', records)
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
