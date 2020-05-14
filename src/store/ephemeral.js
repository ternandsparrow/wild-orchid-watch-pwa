import { isNil } from 'lodash'
import { wrap as comlinkWrap } from 'comlink'
import dms2dec from 'dms2dec'
import * as constants from '@/misc/constants'
import {
  getExifFromBlob,
  wowWarnHandler,
  wowWarnMessage,
  isInBoundingBox,
} from '@/misc/helpers'

/**
 * A vuex module for anything that should NOT be saved to local storage.
 *
 * Put anything here that meets any of the following:
 *  - doesn't serialise well, like functions or references
 *  - shouldn't be saved between sessions, like "are we online" flag
 */

let imageCompressionWorker = null

const state = {
  // not sure if GA and Sentry belong here but it's easier to pass from UI to
  // store than the other way
  $ga: null,
  $sentry: null,
  networkOnLine: true,
  refreshingApp: false,
  showAddToHomeScreenModalForApple: false,
  swReg: null, // current sw
  SWRegistrationForNewContent: null, // new, waiting sw
  isSplitterOpen: false,
  isForceShowLoginToast: false,
  isGlobalErrorState: false,
  globalErrorUserMsg: null,
  globalErrorImgUrl: null,
  queueProcessorPromise: null,
  isWarnOnLeaveRoute: false,
  isHelpModalVisible: false,
  previewedPhoto: null,
  consoleMsgs: [],
  photoCoords: [],
  deviceCoords: null,
  manualCoords: null,
  geolocationMethod: 'photo',
  photoOutsideBboxErrorMsg: null,
  photoProcessingTasks: [],
  hadSuccessfulDeviceLocReq: false, // in ephemeral so we only remember it for a session
}

const mutations = {
  setUiTraceTools: (state, value) => {
    state.$ga = value.ga
    state.$sentry = value.sentry
  },
  setNetworkOnline: (state, value) => (state.networkOnLine = value),
  setSWRegistrationForNewContent: (state, value) =>
    (state.SWRegistrationForNewContent = value),
  setShowAddToHomeScreenModalForApple: (state, value) =>
    (state.showAddToHomeScreenModalForApple = value),
  setRefreshingApp: (state, value) => (state.refreshingApp = value),
  setQueueProcessorPromise: (state, value) =>
    (state.queueProcessorPromise = value),
  setServiceWorkerRegistration: (state, value) => (state.swReg = value),
  toggleSplitter(state, shouldOpen) {
    if (typeof shouldOpen === 'boolean') {
      state.isSplitterOpen = shouldOpen
    } else {
      state.isSplitterOpen = !state.isSplitterOpen
    }
  },
  setForceShowLoginToast: (state, value) =>
    (state.isForceShowLoginToast = value),
  flagGlobalError: (state, value) => {
    state.isGlobalErrorState = true
    if (typeof value === 'string') {
      state.globalErrorUserMsg = value
      return
    }
    state.globalErrorUserMsg = value.msg
    state.globalErrorImgUrl = value.imgUrl
  },
  resetGlobalErrorState: state => {
    state.isGlobalErrorState = false
    state.globalErrorUserMsg = null
    state.globalErrorImgUrl = null
  },
  enableWarnOnLeaveRoute: state => (state.isWarnOnLeaveRoute = true),
  disableWarnOnLeaveRoute: state => (state.isWarnOnLeaveRoute = false),
  showHelpModal: state => (state.isHelpModalVisible = true),
  hideHelpModal: state => (state.isHelpModalVisible = false),
  previewPhoto: (state, previewedPhoto) =>
    (state.previewedPhoto = previewedPhoto),
  closePhotoPreview: state => (state.previewedPhoto = null),
  pushConsoleMsg: (state, msg) => state.consoleMsgs.push(msg),
  clearConsoleMsgs: state => (state.consoleMsgs = []),
  resetCoordsState: state => {
    state.photoCoords = []
    state.deviceCoords = null
    state.manualCoords = null
    state.geolocationMethod = 'photo'
    state.photoProcessingTasks = []
    state.photoOutsideBboxErrorMsg = null
  },
  setGeolocationMethod: (state, method) => (state.geolocationMethod = method),
  setDeviceCoords: (state, value) => (state.deviceCoords = value),
  setPhotoOutsideBboxErrorMsg: (state, value) =>
    (state.photoOutsideBboxErrorMsg = value),
  clearPhotoOutsideBboxErrorMsg: state =>
    (state.photoOutsideBboxErrorMsg = null),
  pushPhotoCoords: (state, newCoords) => state.photoCoords.push(newCoords),
  popCoordsForPhoto: (state, photoUuid) => {
    const indexOfPhoto = state.photoCoords.findIndex(
      p => p.photoUuid === photoUuid,
    )
    if (!~indexOfPhoto) {
      // we don't have coords for this photo, nothing to do
      return
    }
    state.photoCoords.splice(indexOfPhoto, 1)
  },
  updateUrlForPhotoCoords: (state, { uuid, newUrl }) => {
    const found = state.photoCoords.find(p => p.photoUuid === uuid)
    if (!found) {
      // we don't have coords for this photo, nothing to do
      return
    }
    found.url = newUrl
  },
  setManualCoords: (state, coords) => (state.manualCoords = coords),
  addPhotoProcessingTask: (state, taskTracker) =>
    state.photoProcessingTasks.push(taskTracker),
  markPhotoProcessingTaskDone: (state, taskUuid) => {
    // JS promises can't truly be cancelled. See here for an attempt:
    // https://gist.github.com/tomsaleeba/79384652da2515607bec74e2f45b7e38. The
    // best we can hope for is making sure they don't touch our state
    // in their finally clause. We achieve that by using the photo ID so if
    // we've since "forgotten" about a running promise (by leaving this page
    // and coming back) then it won't interfere with us.
    const found = state.photoProcessingTasks.find(e => e.uuid === taskUuid)
    if (!found) {
      return
    }
    found.isDone = true
  },
  recordSuccessfulDeviceLocReq: state =>
    (state.hadSuccessfulDeviceLocReq = true),
}

const actions = {
  async closeAddToHomeScreenModalForApple({ commit }) {
    commit('app/setAddToHomeIosPromptLastDate', Date.now(), { root: true })
    commit('setShowAddToHomeScreenModalForApple', false)
  },
  serviceWorkerSkipWaiting({ state, commit }) {
    /**
     * Trigger service worker skipWating so the new service worker can take over.
     * This will also trigger a window refresh (see /src/misc/register-service-worker.js)
     */
    if (isNil(state.SWRegistrationForNewContent)) {
      return
    }
    commit('setRefreshingApp', true)
    state.SWRegistrationForNewContent.waiting.postMessage(
      constants.skipWaitingMsg,
    )
  },
  async manualServiceWorkerUpdateCheck({ state }) {
    if (!state.swReg) {
      return false
    }
    try {
      console.debug('Triggering update check on service worker')
      await state.swReg.update()
    } catch (err) {
      // probably the server is down
      console.warn('Failed while trying to check for a new service worker', err)
    }
    return true
  },
  async processPhoto({ commit, dispatch, rootState }, photoObj) {
    const tracker = { uuid: photoObj.uuid, isDone: false }
    commit('addPhotoProcessingTask', tracker)
    try {
      const blobish = photoObj.file
      let originalMetadata
      try {
        originalMetadata = await getExifFromBlob(blobish)
      } catch (err) {
        const safeBlobish = blobish || {} // gotta be careful in a catch
        const blobSize = safeBlobish.size
        const blobType = safeBlobish.type
        wowWarnHandler(
          `Could not read EXIF data from blob with size=${blobSize} bytes and ` +
            `type=${blobType}. Cannot process image, using original image as-is. ` +
            `Error:`,
          err,
        )
        dispatch('uiTrace', {
          category: 'store/ephemeral',
          action: `error reading EXIF from attached photo`,
        })
        // TODO enhancement idea: brute force meansure image dimensions to do
        // resizing, or find them elsewhere?
        return {
          data: blobish,
          location: { isPresent: false },
        }
      }
      ;(function debugMetadata() {
        const slightlyTerserMetadata = Object.assign({}, originalMetadata)
        if (slightlyTerserMetadata.UserComment) {
          slightlyTerserMetadata.UserComment = `(hidden ${slightlyTerserMetadata.UserComment.length} bytes)`
        }
        if (slightlyTerserMetadata.MakerNote) {
          slightlyTerserMetadata.MakerNote = `(hidden ${slightlyTerserMetadata.MakerNote.length} bytes)`
        }
        console.debug(
          `Metadata from photo (before resizing)`,
          JSON.stringify(slightlyTerserMetadata, null, 2),
        )
      })()
      const originalImageSizeMb = blobish.size / 1024 / 1024
      await dispatch('processExifCoords', { originalMetadata, photoObj })
      if (!rootState.app.isEnablePhotoCompression) {
        console.debug('Photo compression disabled, using original photo')
        return blobish
      }
      const maxWidthOrHeight = constants.photoCompressionThresholdPixels
      const dimensionX = originalMetadata.PixelXDimension
      const dimensionY = originalMetadata.PixelYDimension
      const hasDimensionsInExif = dimensionX && dimensionY
      const isPhotoAlreadySmallEnoughDimensions =
        hasDimensionsInExif &&
        dimensionX < maxWidthOrHeight &&
        dimensionY < maxWidthOrHeight
      const isPhotoAlreadySmallEnoughStorage =
        originalImageSizeMb <= constants.photoCompressionThresholdMb
      if (
        isPhotoAlreadySmallEnoughDimensions ||
        isPhotoAlreadySmallEnoughStorage
      ) {
        // don't bother compressing an image that's already small enough
        const dimMsg = hasDimensionsInExif
          ? `X=${dimensionX}, Y=${dimensionY}`
          : '(No EXIF dimensions)'
        console.debug(
          `No compresion needed for ${dimMsg},` +
            ` ${originalImageSizeMb.toFixed(3)} MB image`,
        )
        return blobish
      }
      try {
        if (!imageCompressionWorker) {
          imageCompressionWorker = interceptableFns.buildWorker()
        }
        const compressedBlobish = await imageCompressionWorker.resize(
          blobish,
          maxWidthOrHeight,
        )
        return compressedBlobish
      } catch (err) {
        wowWarnHandler(
          `Failed to compress a photo with MIME=${blobish.type}, ` +
            `size=${blobish.size} and EXIF=${JSON.stringify(
              originalMetadata,
            )}. ` +
            'Falling back to original image.',
          err,
        )
        // fallback to using the fullsize image
        return blobish
      }
    } finally {
      commit('markPhotoProcessingTaskDone', photoObj.uuid)
    }
  },
  processExifCoords({ commit, dispatch }, { originalMetadata, photoObj }) {
    const { lat, lng } = extractGps(originalMetadata)
    const isLocationPresent = !!(lat && lng)
    if (!isLocationPresent) {
      dispatch('uiTrace', {
        category: 'store/ephemeral',
        action: `attached photo is missing GPS coords`,
      })
      const debugInfo = {
        gpsFields: Object.keys(originalMetadata)
          .filter(k => k.startsWith('GPS'))
          .reduce((accum, currKey) => {
            accum[currKey] = originalMetadata[currKey]
            return accum
          }, {}),
        make: originalMetadata.Make,
        model: originalMetadata.Model,
        xDimension: originalMetadata.PixelXDimension,
        yDimension: originalMetadata.PixelYDimension,
        blobSizeBytes: photoObj.file.size,
        blobType: photoObj.file.type,
      }
      console.debug(
        `Attached photo is missing GPS coords, summary: ${JSON.stringify(
          debugInfo,
          null,
          2,
        )}`,
      )
      return
    }
    if (!isInBoundingBox(lat, lng)) {
      commit(
        'setPhotoOutsideBboxErrorMsg',
        `<img style="width: 230px;" src="${photoObj.url}"><br />` +
          `This photo has GPS coordinates (${lat},${lng}) but they look ` +
          `like they're outside Australia so we can't use them. You can ` +
          `still use the photo though.`,
      )
      wowWarnMessage(
        `User tried to use photo metadata coords (${lat},${lng}) that are ` +
          `outside of Australia.`,
      )
      return
    }
    // TODO EXIF doesn't seem to have a field for this. Can we compute
    // based on number of decimal points?
    const locAccuracyFromPhoto = null
    commit('pushPhotoCoords', {
      lat,
      lng,
      accuracy: locAccuracyFromPhoto,
      photoUuid: photoObj.uuid,
      url: photoObj.url,
    })
  },
  uiTrace({ state }, { category, action }) {
    state.$sentry &&
      state.$sentry.addBreadcrumb({
        category: 'ui',
        level: 'info',
        message: `"${category}" had "${action}" occur`,
      })
    state.$ga && state.$ga.event(category, action)
  },
  markUserGeolocation({ commit }) {
    if (!navigator.geolocation) {
      console.debug('Geolocation is not supported by user agent')
      return Promise.reject(constants.notSupported)
    }
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        loc => {
          commit('setDeviceCoords', {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            accuracy: loc.coords.accuracy,
          })
          commit('recordSuccessfulDeviceLocReq')
          return resolve()
        },
        err => {
          // enum from https://developer.mozilla.org/en-US/docs/Web/API/PositionError
          const permissionDenied = 1
          const positionUnavailable = 2
          const timeout = 3
          const errCode = err.code
          switch (errCode) {
            case permissionDenied:
              console.debug('Geolocation is blocked')
              return reject(constants.blocked)
            case positionUnavailable:
              // I think this could be in situations like a desktop computer
              // tethered through a mobile hotspot. You allow access but it
              // still fails.
              console.warn(
                'Geolocation is supported but not available. Error code=' +
                  errCode,
              )
              return reject(constants.failed)
            case timeout:
              console.warn(
                'Geolocation is supported but timed out. Error code=' + errCode,
              )
              return reject(constants.failed)
            default:
              return reject(err)
          }
        },
        {
          timeout: 5000, // milliseconds
        },
      )
    })
  },
}

const ACTIVE = 'active'

const getters = {
  newContentAvailable: state => !isNil(state.SWRegistrationForNewContent),
  swStatus: state => {
    const nullSafeSwReg = state.swReg || {}
    return [ACTIVE, 'installing', 'waiting'].reduce((accum, curr) => {
      accum[curr] = !!nullSafeSwReg[curr]
      return accum
    }, {})
  },
  isSwStatusActive: (state, getters) => getters.swStatus[ACTIVE],
  isLocalProcessorRunning: state => !!state.queueProcessorPromise,
  coordsForCurrentlyEditingObs(state, getters) {
    const geoMethod = state.geolocationMethod
    switch (geoMethod) {
      case 'photo':
        return getters.oldestPhotoCoords
      case 'device':
        return state.deviceCoords
      case 'manual':
        return state.manualCoords
      default:
        throw new Error(
          'Programmer problem: unhandled geolocationMethod=' + geoMethod,
        )
    }
  },
  oldestPhotoCoords(state) {
    return state.photoCoords[0]
  },
  photosStillCompressingCount(state) {
    return state.photoProcessingTasks.filter(e => !e.isDone).length
  },
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
}

function extractGps(parsedExif) {
  const theArgs = [
    parsedExif.GPSLatitude,
    parsedExif.GPSLatitudeRef,
    parsedExif.GPSLongitude,
    parsedExif.GPSLongitudeRef,
  ]
  const isAllFieldsPresent = theArgs.every(e => !!e)
  if (!isAllFieldsPresent) {
    return {}
  }
  const [latDec, lonDec] = dms2dec(...theArgs)
  return { lat: latDec, lng: lonDec }
}

const interceptableFns = {
  buildWorker() {
    return comlinkWrap(
      new Worker('./image-compression.worker.js', {
        type: 'module',
      }),
    )
  },
}

export const _testonly = {
  interceptableFns,
}
