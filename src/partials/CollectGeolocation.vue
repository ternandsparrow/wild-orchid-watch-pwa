<template>
  <div>
    <v-ons-list-item modifier="nodivider">
      <div class="center">
        <!-- FIXME need to handle edit mode -->
        <v-ons-list>
          <v-ons-list-item tappable>
            <label class="left">
              <v-ons-radio
                v-model="geolocationMethod"
                input-id="radio-gm-photo"
                value="photo"
                modifier="material"
              >
              </v-ons-radio>
            </label>
            <div class="center">
              <label for="radio-gm-photo">
                Automatically read GPS coordinates from photo metadata
                (recommended)
              </label>
              <div v-if="geolocationMethod === 'photo'">
                <p
                  v-if="geolocationFromPhotoState === 'captured'"
                  class="success-alert"
                >
                  Yay, we found GPS coordinates in this photo
                  <img :src="obsCoords.url" class="photo-thumb" />
                </p>
                <div
                  v-if="
                    ['no-photos', 'photos-done-no-capture'].includes(
                      geolocationFromPhotoState,
                    )
                  "
                  :class="{
                    'warning-alert': isExtraEmphasis,
                    'info-alert': !isExtraEmphasis,
                  }"
                >
                  <span
                    v-if="
                      geolocationFromPhotoState === 'photos-done-no-capture'
                    "
                  >
                    <v-ons-icon icon="fa-exclamation-circle" />
                    None of the attached photos seem to have GPS coordinates.
                    Either attach another photo that does, or select a different
                    method to get GPS coordinates from this list.
                  </span>
                  <span v-else-if="geolocationFromPhotoState === 'no-photos'">
                    <v-ons-icon icon="fa-info-circle" />
                    Attach some photos and they'll be automatically scanned
                  </span>
                  <h1 v-else style="color: red;">
                    Programmer problem - unhandled state
                    {{ geolocationFromPhotoState }}
                  </h1>
                </div>
                <div
                  v-if="geolocationFromPhotoState === 'processing'"
                  class="info-alert"
                >
                  <v-ons-icon icon="fa-hourglass-half" />
                  Processing photo(s), looking for GPS coordinates
                </div>
              </div>
            </div>
          </v-ons-list-item>
          <v-ons-list-item tappable>
            <label class="left">
              <v-ons-radio
                v-model="geolocationMethod"
                input-id="radio-gm-device"
                value="device"
                modifier="material"
              >
              </v-ons-radio>
            </label>
            <div class="center geolocation-option-label">
              <label for="radio-gm-device">
                Use geolocation of this device, right now.
              </label>
              <p v-if="deviceGeolocationErrorMsg" class="warning-alert">
                <v-ons-icon
                  class="warning"
                  icon="fa-exclamation-circle"
                ></v-ons-icon>
                {{ deviceGeolocationErrorMsg }}. Or consider choosing one of the
                other methods in this list to capture geolocation/GPS
                coordinates.
              </p>
            </div>
          </v-ons-list-item>
          <v-ons-list-item v-if="isAdvancedUserMode" tappable>
            <label class="left">
              <v-ons-radio
                v-model="geolocationMethod"
                input-id="radio-gm-manual"
                value="manual"
                modifier="material"
              >
              </v-ons-radio>
            </label>
            <div class="center geolocation-option-label">
              <label for="radio-gm-manual">
                Manually enter decimal GPS coordinates. Useful for when you have
                a standalone GPS. Press the button when you're done to validate
                the coordinates.
              </label>
              <div class="stop-touching-my-head">
                <label for="manual-lat">Latitude, e.g. -33.123456 </label>
              </div>
              <div class="coord-input">
                <v-ons-input
                  ref="manualLatInput"
                  v-model="manualLat"
                  input-id="manual-lat"
                  type="number"
                  placeholder="Lat"
                  @focus="selectManualGeolocationMethod"
                  @keyup.enter="$event.target.blur()"
                ></v-ons-input>
              </div>
              <div>
                <label for="manual-lon">Longitude, e.g. 150.123456 </label>
              </div>
              <div class="coord-input">
                <v-ons-input
                  v-model="manualLon"
                  html-id="manual-lon"
                  type="number"
                  placeholder="Lon"
                  @focus="selectManualGeolocationMethod"
                  @keyup.enter="$event.target.blur()"
                ></v-ons-input>
              </div>
              <div class="stop-touching-my-head">
                <div
                  v-if="geolocationFromManualState === 'incomplete'"
                  class="info-alert"
                >
                  Enter both lat and lon values
                </div>
                <div
                  v-if="geolocationFromManualState === 'outside-bbox'"
                  class="warning-alert"
                >
                  Your coordinates ({{ manualLat }},{{ manualLon }}) look like
                  they're outside Australia. This app is only for observations
                  made in Australia, sorry.
                </div>
                <div
                  v-if="geolocationFromManualState === 'success'"
                  class="success-alert"
                >
                  Success
                </div>
              </div>
            </div>
          </v-ons-list-item>
        </v-ons-list>
        <div class="wow-obs-field-desc">
          <wow-required-chip />
          Geolocation (GPS coordinates) of this observation.
        </div>
        <div v-show="isLocationAlreadyCaptured">
          <div class="success-alert">
            <v-ons-icon icon="fa-map-marked-alt" />
            Geolocation successfully captured from
            {{ geolocationMethod }}.
            <div>
              <v-ons-button modifier="quiet" @click="toggleMap">
                <span v-if="!isShowMap">View location on </span>
                <span v-if="isShowMap">Hide </span>map</v-ons-button
              >
            </div>
            <div v-if="isShowMap">Coordinates= {{ obsLat }},{{ obsLng }}</div>
          </div>
          <google-map
            v-if="isShowMap"
            :marker-position="obsCoords"
            style="width: 94vw;"
          />
        </div>
      </div>
      <wow-input-status
        :is-ok="isLocationAlreadyCaptured"
        class="right"
      ></wow-input-status>
    </v-ons-list-item>
  </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import {
  isInBoundingBox,
  wowErrorHandler,
  wowWarnMessage,
} from '@/misc/helpers'
import { blocked, failed, notSupported } from '@/misc/constants'

export default {
  name: 'CollectGeolocation',
  props: {
    photoCount: {
      type: Number,
      required: true,
    },
    isExtraEmphasis: {
      type: Boolean,
      required: true,
    },
  },
  data() {
    return {
      isShowMap: false,
      manualLat: null,
      manualLon: null,
      deviceGeolocationErrorMsg: null,
    }
  },
  computed: {
    ...mapState('app', ['isAdvancedUserMode']),
    ...mapState('ephemeral', ['photoOutsideBboxErrorMsg']),
    ...mapGetters('ephemeral', [
      'oldestPhotoCoords',
      'coordsForCurrentlyEditingObs',
      'photosStillCompressingCount',
    ]),
    geolocationMethod: {
      get() {
        return this.$store.state.ephemeral.geolocationMethod
      },
      set(val) {
        return this.$store.commit('ephemeral/setGeolocationMethod', val)
      },
    },
    isLocationAlreadyCaptured() {
      return !!(this.obsLat && this.obsLng)
    },
    obsCoords() {
      return this.coordsForCurrentlyEditingObs
    },
    obsLat() {
      return (this.obsCoords || {}).lat
    },
    obsLng() {
      return (this.obsCoords || {}).lng
    },
    geolocationFromPhotoState() {
      if (this.isLocationAlreadyCaptured) {
        return this.geolocationMethod === 'photo'
          ? 'captured'
          : 'not-from-photo'
      }
      const isPhotosStillProcessing = !!this.photosStillCompressingCount
      if (isPhotosStillProcessing) {
        return 'processing'
      }
      const isNoPhotos = !this.photoCount
      if (isNoPhotos) {
        return 'no-photos'
      }
      return 'photos-done-no-capture'
    },
    geolocationFromManualState() {
      if (this.geolocationMethod !== 'manual') {
        return 'nothing'
      }
      if (!this.isManualLatAndLon) {
        return 'incomplete'
      }
      const lat = parseFloat(this.manualLat)
      const lng = parseFloat(this.manualLon)
      const isInBbox = isInBoundingBox(lat, lng)
      if (isInBbox) {
        return 'success'
      }
      return 'outside-bbox'
    },
    isManualLatAndLon() {
      return this.manualLat && this.manualLon
    },
    proposedManualCoordsObj() {
      // we need to construct this obj so we can watch something that changes
      // on each input. If we just watched the geolocationFromManualState, it
      // would NOT change when going from one valid input to another, so we
      // wouldn't emit the change
      const lat = parseFloat(this.manualLat)
      const lng = parseFloat(this.manualLon)
      const accuracy = null // TODO should we ask the user for this?
      return {
        lat,
        lng,
        accuracy,
      }
    },
  },
  watch: {
    geolocationMethod(newVal) {
      const strategies = {
        device: this.getDeviceGpsLocation,
      }
      const strat = strategies[newVal]
      strat && strat()
      // always poke the parent so it can "clear" old coords if needed
      this.pokeParentToReadCoords()
    },
    photoOutsideBboxErrorMsg(newVal) {
      if (!newVal) {
        return
      }
      this.$ons.notification.alert(newVal).then(() => {
        this.$store.commit('ephemeral/clearPhotoOutsideBboxErrorMsg')
      })
    },
    oldestPhotoCoords() {
      this.pokeParentToReadCoords()
    },
    proposedManualCoordsObj(newVal) {
      if (this.geolocationFromManualState !== 'success') {
        return
      }
      this.$store.commit('ephemeral/setManualCoords', newVal)
      this.pokeParentToReadCoords()
    },
    isAdvancedUserMode(newVal) {
      const isSwappedToBeginner = !newVal
      if (isSwappedToBeginner && this.geolocationMethod === 'manual') {
        this.geolocationMethod = 'photo'
      }
    },
  },
  beforeMount() {
    this.$store.commit('ephemeral/resetCoordsState')
  },
  beforeDestroy() {
    this.$store.commit('ephemeral/resetCoordsState')
  },
  methods: {
    pokeParentToReadCoords() {
      this.$emit('read-coords')
    },
    async getDeviceGpsLocation() {
      this.$wow.uiTrace('CollectGeolocation', `get device GPS location`)
      if (!this.$store.state.ephemeral.hadSuccessfulDeviceLocReq) {
        // there's no API to check if we have geolocation access without
        // actually asking for the permission. To streamline things a bit, we
        // assume if we've been successful in this session, we'll continue to
        // be. We only store it in ephemeral so it's forgetten for the next
        // session
        await this.$ons.notification.alert(
          'We are about to get the current location of your device. ' +
            'You may be prompted to allow/block this access. ' +
            'It is important that you ' +
            '*allow* (do not block) this access.',
        )
      }
      try {
        await this.$store.dispatch('ephemeral/markUserGeolocation')
        const coords = this.$store.state.ephemeral.deviceCoords
        const lat = coords.lat
        const lng = coords.lng
        if (!isInBoundingBox(lat, lng)) {
          await this.$ons.notification.alert(
            `Your coordinates (${lat},${lng}) look like they're outside Australia. ` +
              `This app is only for observations made in Australia, sorry.`,
          )
          wowWarnMessage(
            `User tried to use device coords (${lat},${lng}) that are ` +
              `outside of Australia.`,
          )
          return
        }
        this.pokeParentToReadCoords()
      } catch (err) {
        console.debug('No geolocation access for us.', err)
        this.deviceGeolocationErrorMsg = (() => {
          if (err === notSupported) {
            this.$wow.uiTrace(
              'CollectGeolocation',
              'device location not supported',
            )
            return 'Geolocation is not supported by your device'
          }
          if (err === blocked) {
            this.$wow.uiTrace('CollectGeolocation', 'device location blocked')
            return (
              'You have blocked access to your device' +
              ' geolocation. Google for something like "reset ' +
              'browser geolocation permission" to find out ' +
              'how to unblock'
            )
          }
          if (err === failed) {
            this.$wow.uiTrace('CollectGeolocation', 'device location failed')
            return (
              `Geolocation seems to be supported and not blocked but ` +
              'something went wrong while accessing your position'
            )
          }
          wowErrorHandler(
            'ProgrammerError: geolocation access failed but in a' +
              ' way that we did not plan for, we should handle this. ' +
              `err.code=${err.code}.`,
            err,
          )
          return 'Something went wrong while trying to access your geolocation'
        })()
      }
    },
    toggleMap() {
      this.$wow.uiTrace('CollectGeolocation', `show map`)
      this.isShowMap = !this.isShowMap
    },
    selectManualGeolocationMethod() {
      this.geolocationMethod = 'manual'
    },
  },
}
</script>

<style scoped lang="scss">
.geolocation-option-label {
  flex-direction: column;
  align-items: flex-start;
}

.stop-touching-my-head {
  margin-top: 1em;
}

.coord-input {
  padding-left: 1em;
}

.success-alert,
.info-alert,
.warning-alert {
  padding: 1em;
  border-radius: 10px;
  margin: 0 auto;
}

.warning-alert {
  border: 1px solid orange;
  background: #ffeabb;
}

.success-alert {
  border: 1px solid green;
  background: #d5ffbf;
}

.info-alert {
  border: 1px solid blue;
  background: #e9f5ff;
}

.photo-thumb {
  width: 100px;
  max-height: 300px;
}
</style>