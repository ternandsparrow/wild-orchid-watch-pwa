<template>
  <div>
    <v-ons-list-item modifier="nodivider">
      <div class="center">
        <v-ons-list>
          <v-ons-list-item v-if="isEdit" tappable>
            <label class="left">
              <v-ons-radio
                v-model="datetimeMethod"
                input-id="radio-dm-existing"
                value="existing"
                modifier="material"
              >
              </v-ons-radio>
            </label>
            <div class="center wow-radio-option-label">
              <label for="radio-dm-existing">
                Use existing value in saved record
              </label>
            </div>
          </v-ons-list-item>
          <v-ons-list-item tappable>
            <label class="left">
              <v-ons-radio
                v-model="datetimeMethod"
                input-id="radio-dm-photo"
                value="photo"
                modifier="material"
              >
              </v-ons-radio>
            </label>
            <div class="center">
              <label for="radio-dm-photo">
                Automatically read date/time from metadata of photos being
                uploaded now <span v-if="!isEdit">(recommended)</span>
              </label>
              <div v-if="datetimeMethod === 'photo'">
                <p
                  v-if="datetimeFromPhotoState === 'captured'"
                  class="success-alert"
                >
                  Yay, we found date/time in this photo<br />
                  <img :src="theDatetime.url" class="photo-thumb" />
                </p>
                <div
                  v-if="
                    ['no-photos', 'photos-done-no-capture'].includes(
                      datetimeFromPhotoState,
                    )
                  "
                  :class="{
                    'warning-alert': isExtraEmphasis,
                    'info-alert': !isExtraEmphasis,
                  }"
                >
                  <span
                    v-if="datetimeFromPhotoState === 'photos-done-no-capture'"
                  >
                    <v-ons-icon icon="fa-exclamation-circle" />
                    None of the attached photos seem to have date/time metadata.
                    Either attach another photo that does, or select a different
                    method from this list to get the observation date/time.
                  </span>
                  <span v-else-if="datetimeFromPhotoState === 'no-photos'">
                    <v-ons-icon icon="fa-info-circle" />
                    Attach some photos and they'll be automatically scanned
                  </span>
                  <h1 v-else style="color: red;">
                    Programmer problem - unhandled state
                    {{ datetimeFromPhotoState }}
                  </h1>
                </div>
                <div
                  v-if="datetimeFromPhotoState === 'processing'"
                  class="info-alert"
                >
                  <v-ons-icon icon="fa-hourglass-half" />
                  Processing photo(s), looking for date/time
                </div>
              </div>
            </div>
          </v-ons-list-item>
          <v-ons-list-item tappable>
            <label class="left">
              <v-ons-radio
                v-model="datetimeMethod"
                input-id="radio-dm-device"
                value="device"
                modifier="material"
              >
              </v-ons-radio>
            </label>
            <div class="center wow-radio-option-label">
              <label for="radio-dm-device">
                Use date/time of this device, right now.
              </label>
            </div>
          </v-ons-list-item>
          <v-ons-list-item v-if="isDetailedUserMode" tappable>
            <label class="left">
              <v-ons-radio
                v-model="datetimeMethod"
                input-id="radio-dm-manual"
                value="manual"
                modifier="material"
                @click="selectManualDatetimeMethod"
              >
              </v-ons-radio>
            </label>
            <div class="center wow-radio-option-label">
              <label for="radio-dm-manual">
                Manually enter the date and time this observation way made on.
                <span v-if="!isNativeDateInputSupported">
                  For dates, use the reverse gregorian format YYYY-MM-DD (e.g.
                  2020-06-25). For times, use colon separated 24 hour time HH-mm
                  (e.g. 16:55).
                </span>
              </label>
              <div class="stop-touching-my-head">
                <label for="manual-date"
                  >Date<span v-if="!isNativeDateInputSupported"
                    >, e.g. 2020-07-19</span
                  ></label
                >
              </div>
              <div class="datetime-input">
                <v-ons-input
                  v-model="manualDate"
                  input-id="manual-date"
                  type="date"
                  placeholder="Date"
                  @focus="selectManualDatetimeMethod"
                  @keyup.enter="$event.target.blur()"
                ></v-ons-input>
              </div>
              <div>
                <label for="manual-time"
                  >Time<span v-if="!isNativeDateInputSupported"
                    >, e.g. 15:33</span
                  ></label
                >
              </div>
              <div class="datetime-input">
                <v-ons-input
                  v-model="manualTime"
                  html-id="manual-time"
                  type="time"
                  placeholder="Time"
                  @focus="selectManualDatetimeMethod"
                  @keyup.enter="$event.target.blur()"
                ></v-ons-input>
              </div>
              <div class="stop-touching-my-head">
                <div
                  v-if="datetimeFromManualState === 'incomplete'"
                  class="info-alert"
                >
                  Enter both date and time values
                </div>
                <div
                  v-if="datetimeFromManualState === 'invalid'"
                  class="warning-alert"
                >
                  Invalid value(s). Please use the correct input formats.
                </div>
                <div
                  v-if="datetimeFromManualState === 'success'"
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
          Date and time of when this observation occurred. The timezone is where
          you currently are (specifically the timezone of your device).
        </div>
        <div v-show="isDatetimeAlreadyCaptured">
          <div class="success-alert">
            <v-ons-icon icon="fa-clock" />
            Date/time successfully captured from
            {{ datetimeMethod }}.<br />
            Value = {{ formattedDatetime }}.
          </div>
        </div>
      </div>
      <wow-input-status
        :is-ok="isDatetimeAlreadyCaptured"
        class="right"
      ></wow-input-status>
    </v-ons-list-item>
  </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import dayjs from 'dayjs'

export default {
  name: 'CollectDate',
  props: {
    photoCount: {
      type: Number,
      required: true,
    },
    isExtraEmphasis: {
      type: Boolean,
      required: true,
    },
    isEdit: {
      type: Boolean,
      required: true,
    },
  },
  data() {
    return {
      manualDate: nowDate(),
      manualTime: nowTime(),
      isNativeDateInputSupported: (function() {
        // thanks https://gomakethings.com/how-to-check-if-a-browser-supports-native-input-date-pickers/
        const input = document.createElement('input')
        const value = 'a'
        input.setAttribute('type', 'date')
        input.setAttribute('value', value)
        return input.value !== value
      })(),
    }
  },
  computed: {
    ...mapState('app', ['isDetailedUserMode']),
    ...mapGetters('ephemeral', [
      'datetimeOfOldestPhoto',
      'datetimeForCurrentlyEditingObs',
      'photosStillProcessingCount',
    ]),
    datetimeMethod: {
      get() {
        return this.$store.state.ephemeral.datetimeMethod
      },
      set(val) {
        return this.$store.commit('ephemeral/setDatetimeMethod', val)
      },
    },
    isDatetimeAlreadyCaptured() {
      return !!(this.theDatetime || {}).value
    },
    theDatetime() {
      return this.datetimeForCurrentlyEditingObs
    },
    formattedDatetime() {
      const val = (this.theDatetime || {}).value
      if (!val) {
        return null
      }
      const d = dayjs(val)
      return `${d.format('DD-MMM-YYYY HH:mm')}  (${d.fromNow()})`
    },
    datetimeFromPhotoState() {
      if (this.isDatetimeAlreadyCaptured) {
        return this.datetimeMethod === 'photo' ? 'captured' : 'not-from-photo'
      }
      const isPhotosStillProcessing = !!this.photosStillProcessingCount
      if (isPhotosStillProcessing) {
        return 'processing'
      }
      const isNoPhotos = !this.photoCount
      if (isNoPhotos) {
        return 'no-photos'
      }
      return 'photos-done-no-capture'
    },
    datetimeFromManualState() {
      if (this.datetimeMethod !== 'manual') {
        return 'nothing'
      }
      if (!this.isManualDateAndTime) {
        return 'incomplete'
      }
      if (!dayjs(`${this.manualDate}${this.manualTime}`).isValid()) {
        return 'invalid'
      }
      // TODO enhancement idea: if you decide that only certain dates make
      // sense, you can add some validation for that here. Perhaps you only want
      // dates after 1970 (the unix epoch) or nothing in the future.
      return 'success'
    },
    isManualDateAndTime() {
      return this.manualDate && this.manualTime
    },
    proposedManualDatetimeObj() {
      // we need to construct this obj so we can watch something that changes
      // on each input. If we just watched the datetimeFromManualState, it
      // would NOT change when going from one valid input to another, so we
      // wouldn't emit the change
      const parsed = dayjs(`${this.manualDate} ${this.manualTime}`)
      const result = parsed.unix() * 1000
      return result
    },
  },
  watch: {
    datetimeMethod(newVal) {
      const strategies = {
        device: this.getDeviceDatetime,
      }
      const strategy = strategies[newVal]
      strategy && strategy()
      // always poke the parent so it can "clear" old value if needed
      this.pokeParentToReadDatetime()
    },
    datetimeOfOldestPhoto() {
      this.pokeParentToReadDatetime()
    },
    proposedManualDatetimeObj(newVal) {
      if (this.datetimeFromManualState !== 'success') {
        return
      }
      this.useManualValue(newVal)
    },
    isDetailedUserMode(newVal) {
      const isSwappedToBasic = !newVal
      if (isSwappedToBasic && this.datetimeMethod === 'manual') {
        this.datetimeMethod = 'photo'
      }
    },
  },
  methods: {
    pokeParentToReadDatetime() {
      this.$emit('read-datetime')
    },
    getDeviceDatetime() {
      this.$wow.uiTrace('CollectDate', `get device datetime`)
      this.pokeParentToReadDatetime()
    },
    selectManualDatetimeMethod() {
      this.datetimeMethod = 'manual'
      this.useManualValue(this.proposedManualDatetimeObj)
    },
    useManualValue(val) {
      this.$store.commit('ephemeral/setManualDatetime', val)
      this.pokeParentToReadDatetime()
    },
  },
}

function nowDate() {
  return dayjs().format('YYYY-MM-DD')
}

function nowTime() {
  return dayjs().format('HH:mm')
}
</script>

<style scoped lang="scss">
.stop-touching-my-head {
  margin-top: 1em;
}

.datetime-input {
  padding-left: 1em;
}

.photo-thumb {
  width: 100px;
  max-height: 300px;
}
</style>
