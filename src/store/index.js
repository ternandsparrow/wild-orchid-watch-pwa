import Vue from 'vue'
import Vuex from 'vuex'
import createPersistedState from 'vuex-persistedstate'

import { subscribeToWorkerMessage } from '@/misc/web-worker-manager'
import {
  isForceVueDevtools,
  persistedStateLocalStorageKey,
  recordProcessingOutcomeFieldName,
  workerMessages,
} from '@/misc/constants'
import { wowErrorHandler } from '@/misc/helpers'
import auth from './auth'
import app from './app'
import ephemeral from './ephemeral'
import obs, {
  apiTokenHooks as obsApiTokenHooks,
  migrate as obsMigrate,
} from './obs'
import missionsAndNews from './missionsAndNews'

if (isForceVueDevtools) {
  Vue.config.devtools = true
}
Vue.use(Vuex)

const store = new Vuex.Store({
  strict: process.env.NODE_ENV !== 'production',
  plugins: [
    createPersistedState({
      key: persistedStateLocalStorageKey,
      setState: (key, state, storage) => {
        const cleanedState = { ...state }
        // don't persist anything in the ephemeral module, we assume nothing in
        // it will serialise nicely or should be saved.
        delete cleanedState.ephemeral
        // Jul 2020 migration to remove old namespaces
        delete cleanedState.missions
        delete cleanedState.news
        // Aug 2020 remove fields no longer used
        delete cleanedState.obs.selectedObservationId
        storage.setItem(key, JSON.stringify(cleanedState))
      },
    }),
  ],
  actions: {
    doApiGet({ dispatch }, argObj) {
      return dispatch('auth/doApiGet', argObj)
    },
    doApiPost({ dispatch }, argObj) {
      return dispatch('auth/doApiPost', argObj)
    },
    doApiPut({ dispatch }, argObj) {
      return dispatch('auth/doApiPut', argObj)
    },
    doApiDelete({ dispatch }, argObj) {
      return dispatch('auth/doApiDelete', argObj)
    },
    flagGlobalError({ commit }, { msg, userMsg, imgUrl, err }) {
      commit('ephemeral/flagGlobalError', {
        msg: userMsg || msg,
        imgUrl,
        isNetworkErrorWow: err.isNetworkErrorWow,
      })
      wowErrorHandler(msg, err)
    },
    healthcheck({ dispatch }) {
      return dispatch('obs/healthcheck')
    },
    async autoJoinInatProject({ dispatch, getters }) {
      const logPrefix = '[project auto-join]'
      try {
        await dispatch('obs/waitForProjectInfo')
        if (getters.isJoinedProject) {
          console.debug(
            `${logPrefix} user already in project, no auto-join needed`,
          )
          return
        }
        console.debug(`${logPrefix} user NOT in project, auto-joining!`)
        await dispatch('joinInatProject')
      } catch (err) {
        // it's not the end of the world, we will still show the nag alert
        wowErrorHandler(
          'Failed to auto-join iNat project on OAuth callback',
          err,
        )
      }
    },
    async joinInatProject({ dispatch, getters }) {
      await dispatch('obs/waitForProjectInfo')
      const projectId = getters['obs/projectId']
      const resp = await dispatch('doApiPost', {
        urlSuffix: `/projects/${projectId}/join`,
      })
      await dispatch('obs/getProjectInfo')
      return resp
    },
  },
  getters: {
    myUserId(_, getters) {
      return getters['auth/myUserId']
    },
    myLocale(_, getters) {
      return getters['auth/myLocale']
    },
    myPlaceId(_, getters) {
      return getters['auth/myPlaceId']
    },
    isJoinedProject(state, getters) {
      const joinedUserIds = (state.obs.projectInfo || {}).user_ids || []
      const { myUserId } = getters
      return joinedUserIds.includes(myUserId)
    },
  },
  modules: {
    app,
    auth,
    ephemeral,
    missionsAndNews,
    obs,
  },
})

subscribeToWorkerMessage('refreshLocalRecordQueue', () => {
  return store.dispatch('obs/refreshLocalRecordQueue')
})

subscribeToWorkerMessage(workerMessages.facadeDeleteSuccess, ({ theUuid }) => {
  return store.commit('obs/handleObsDeleteCompletion', theUuid)
})

subscribeToWorkerMessage(workerMessages.facadeUpdateSuccess, ({ summary }) => {
  return store.commit('obs/handleObsCreateOrEditCompletion', summary)
})

subscribeToWorkerMessage(workerMessages.onLocalRecordTransition, (args) => {
  return store.commit('obs/handleLocalQueueSummaryPatch', {
    recordUuid: args.recordUuid,
    thePatch: {
      [recordProcessingOutcomeFieldName]: args.targetOutcome,
    },
  })
})

subscribeToWorkerMessage(workerMessages.onRetryComplete, (recordUuid) => {
  return store.commit('obs/handleLocalQueueSummaryPatch', {
    recordUuid,
    thePatch: {
      wowRetryAt: new Date().toISOString(),
    },
  })
})

subscribeToWorkerMessage(workerMessages.requestApiTokenRefresh, () => {
  return store.dispatch('auth/getApiToken')
})

// make sure all your hooks are async or return promises
const allApiTokenHooks = [...obsApiTokenHooks]

store.watch(
  (state) => state.auth.apiTokenAndUserLastUpdated,
  () => {
    console.debug('API Token and user details changed, triggering hooks')
    allApiTokenHooks.forEach((curr) => {
      curr(store).catch((err) => {
        store.dispatch(
          'flagGlobalError',
          {
            msg: `Failed while executing an API Token hook`,
            userMsg: `Error encountered while synchronising data with the server`,
            err,
          },
          { root: true },
        )
      })
    })
  },
)

export default store

/**
 * Add any code here that migrates vuex stores on user devices to match what we
 * expect in this version of the codebase.
 */
export async function migrateOldStores(storeParam) {
  await obsMigrate(storeParam)
}
