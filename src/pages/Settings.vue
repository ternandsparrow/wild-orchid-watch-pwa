<template>
  <menu-wrapper title="Settings">
    <v-ons-list>
      <ons-list-item>
        <div class="center">
          <span class="list-item__title">When to sync with iNaturalist</span
          ><span class="list-item__subtitle"
            >Control your data usage. You could turn sync off while you're in
            the field then re-enable it once you're back in range of WiFi.</span
          >
          <div class="wow-options-container">
            <v-ons-select v-model="whenToSync">
              <option
                v-for="curr in whenToSyncOptions"
                :key="'wtu-' + curr.value"
                :value="curr.value"
              >
                {{ curr.label }}
              </option>
            </v-ons-select>
          </div>
        </div>
      </ons-list-item>
      <ons-list-item>
        <label class="center" for="compressSwitch">
          <span class="list-item__title"><a>Compress/resize photos</a></span
          ><span class="list-item__subtitle"
            >Enabling this setting will use less storage space on your phone and
            less data during upload. The tradeoff is observations will take a
            bit longer to save while your device makes the photos smaller.</span
          >
        </label>
        <div class="right">
          <v-ons-switch
            v-model="isEnablePhotoCompression"
            input-id="compressSwitch"
          >
          </v-ons-switch>
        </div>
      </ons-list-item>
      <ons-list-item>
        <label class="center" for="accuracySwitch">
          <span class="list-item__title"><a>Use High Accuracy GPS</a></span
          ><span class="list-item__subtitle"
            >Enabling this setting will use high accuracy geolocation. The
            tradeoff is increased drain on the battery of your device.</span
          >
        </label>
        <div class="right">
          <v-ons-switch
            v-model="isEnableHighAccuracy"
            input-id="accuracySwitch"
          >
          </v-ons-switch>
        </div>
      </ons-list-item>
      <ons-list-item>
        <label class="center" for="advancedSwitch">
          <span class="list-item__title"><a>Advanced mode</a></span
          ><span class="list-item__subtitle"
            >If enabled, more questions will be asked when creating
            observations. The extra questions are all optional.</span
          >
        </label>
        <div class="right">
          <v-ons-switch v-model="isAdvancedUserMode" input-id="advancedSwitch">
          </v-ons-switch>
        </div>
      </ons-list-item>
      <v-ons-list-header>Info</v-ons-list-header>
      <ons-list-item>
        <div class="left wow-flexcol">
          <div>Storage usage:</div>
          <div v-show="!isStorageReadable" class="error-msg">
            😞 Cannot compute used storage. Your device doesn't report storage
            statistics.
          </div>
          <div v-show="isStorageReadable">{{ storageMsg }}</div>
        </div>
        <div class="right">
          <v-ons-progress-circular
            v-show="isStorageReadable"
            :value="storageUsedPercent"
            secondary-value="100"
          ></v-ons-progress-circular>
        </div>
      </ons-list-item>
      <v-ons-list-header>Actions</v-ons-list-header>
      <ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >Logout from Wild Orchid Watch and iNaturalist</span
          ><span class="list-item__subtitle"
            >Will delete all local app data</span
          >
        </div>
        <div class="right">
          <v-ons-button name="logout-btn" @click="doLogout"
            >Logout</v-ons-button
          >
        </div>
      </ons-list-item>
      <ons-list-item>
        <div class="center">
          <span class="list-item__title">View onboarder again</span
          ><span class="list-item__subtitle"
            >The series of information you saw when you first used this
            app</span
          >
        </div>
        <div class="right">
          <v-ons-button
            name="show-onboarder-btn"
            @click="handleResetOnboarderClick"
            >Show now</v-ons-button
          >
        </div>
      </ons-list-item>
      <ons-list-item>
        <div class="center">
          <span class="list-item__title">Refresh iNaturalist profile</span
          ><span class="list-item__subtitle"
            >Refreshed daily but this will trigger a refresh now</span
          >
        </div>
        <div class="right">
          <v-ons-button
            name="refresh-inat-profile-btn"
            @click="doInatProfileRefresh"
            >Refresh</v-ons-button
          >
        </div>
      </ons-list-item>
      <ons-list-item>
        <div class="center">
          <span class="list-item__title">Check for app update now</span
          ><span class="list-item__subtitle"
            >If an update is available, you will be prompted to install it</span
          >
        </div>
        <div class="right">
          <v-ons-button
            name="manual-wow-update-btn"
            @click="doManualUpdateCheck"
            >Check</v-ons-button
          >
        </div>
      </ons-list-item>
    </v-ons-list>
  </menu-wrapper>
</template>

<script>
import { mapState } from 'vuex'
import { deleteKnownStorageInstances } from '@/indexeddb/storage-manager'
import { alwaysUpload, neverUpload } from '@/misc/constants'
import {
  clearLocalStorage,
  formatStorageSize,
  unregisterAllServiceWorkers,
} from '@/misc/helpers'

export default {
  name: 'Settings',
  data() {
    return {
      whenToSyncOptions: [
        { value: alwaysUpload, label: 'Always (WiFi, mobile data)' },
        { value: neverUpload, label: 'Never' },
      ],
      storageQuota: 0,
      storageUsage: 0,
      storageUsedPercent: 0,
      isStorageReadable: true,
    }
  },
  computed: {
    ...mapState('obs', ['localQueueSummary']),
    ...mapState('auth', ['token']),
    unsyncRecordsCount() {
      return this.localQueueSummary.length
    },
    whenToSync: {
      get() {
        return this.$store.state.app.whenToSync
      },
      set(newValue) {
        this.$store.commit('app/setWhenToSync', newValue)
      },
    },
    isEnablePhotoCompression: {
      get() {
        return this.$store.state.app.isEnablePhotoCompression
      },
      set(newValue) {
        this.$store.commit('app/setEnablePhotoCompression', newValue)
      },
    },
    isAdvancedUserMode: {
      get() {
        return this.$store.state.app.isAdvancedUserMode
      },
      set(newValue) {
        this.$store.commit('app/setIsAdvancedUserMode', newValue)
      },
    },
    isEnableHighAccuracy: {
      get() {
        return this.$store.state.app.isEnableHighAccuracy
      },
      set(newValue) {
        this.$store.commit('app/isEnableHighAccuracy', newValue)
      },
    },
    storageMsg() {
      const quota = formatStorageSize(this.storageQuota)
      const usage = formatStorageSize(this.storageUsage)
      return `Used ${usage} of ${quota} (${this.storageUsedPercent}%)`
    },
  },
  created() {
    this.updateStorageStats()
  },
  methods: {
    async doInatProfileRefresh() {
      await this.$store.dispatch('auth/updateUserDetails')
      this.$ons.notification.toast('Profile refreshed', {
        timeout: 2000,
        animation: 'ascend',
      })
    },
    handleResetOnboarderClick() {
      this.$store.commit('app/setIsFirstRun', true)
      this.$router.push({ name: 'Onboarder' })
    },
    async doLogout() {
      try {
        const msgFragmentLocalData = (() => {
          if (this.unsyncRecordsCount) {
            return (
              `You have ${this.unsyncRecordsCount} records` +
              ' that have NOT been synchronised to the server and will be lost forever!'
            )
          }
          return (
            'All your local data has been synchronised to the server, ' +
            'no data will be lost.'
          )
        })()
        const msgFragmentInatLogout = this.token
          ? ' We also need to logout of iNaturalist, which will be done by ' +
            'opening a new window in your browser. You can safely close this ' +
            'window once the logout has happened.'
          : ''
        const msg =
          'Are you sure? All data for this app will be deleted! ' +
          msgFragmentLocalData +
          msgFragmentInatLogout
        const isConfirmed = await this.$ons.notification.confirm(msg)
        if (!isConfirmed) {
          this.$ons.notification.toast('Logout cancelled', {
            timeout: 1000,
            animation: 'ascend',
          })
          return
        }
        await this.$store.dispatch('auth/doLogout')
        clearLocalStorage()
        unregisterAllServiceWorkers()
        await deleteKnownStorageInstances()
        await this.$ons.notification.alert(
          'Logged out and all data wiped, press ok to restart the app in a clean state',
        )
        window.location.reload()
      } catch (err) {
        this.$store.dispatch(
          'flagGlobalError',
          {
            msg: 'Failed during logout',
            userMsg: 'Something went wrong while trying to logout',
            err,
          },
          { root: true },
        )
      }
    },
    doManualUpdateCheck() {
      this.$store
        .dispatch('ephemeral/manualServiceWorkerUpdateCheck')
        .then(isChecking => {
          if (isChecking) {
            this.$ons.notification.toast('Checking for updates', {
              timeout: 3000,
              animation: 'ascend',
            })
            return
          }
          this.$ons.notification.toast('Cannot update, no service worker', {
            timeout: 3000,
            animation: 'ascend',
          })
        })
    },
    async updateStorageStats() {
      const isStorageApiSupported = !!(navigator.storage || {}).estimate
      if (!isStorageApiSupported) {
        this.isStorageReadable = false
        return
      }
      const estimate = await navigator.storage.estimate()
      this.storageQuota = estimate.quota
      this.storageUsage = estimate.usage
      const usedPercentRaw = (this.storageUsage / this.storageQuota) * 100
      if (isNaN(usedPercentRaw)) {
        this.isStorageReadable = false
        this.storageUsedPercent = 0
      } else {
        this.storageUsedPercent = twoDecimalPlaces(usedPercentRaw)
      }
    },
  },
}

function twoDecimalPlaces(v) {
  return +v.toFixed(2)
}
</script>

<style lang="scss" scoped>
.error-msg {
  color: #777;
}

.wow-flexcol {
  flex-direction: column;
  align-items: flex-start;
}

.wow-options-container {
  order: 1;
  text-align: center;
  flex-basis: 100%;
}
</style>
