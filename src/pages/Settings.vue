<template>
  <v-ons-page>
    <v-ons-list>
      <v-ons-list-header
        >You can customise the WoW Field Data Collection App's settings
        here</v-ons-list-header
      >
      <ons-list-item>
        <label class="center">
          Logout from Wild Orchid Watch and iNaturalist, and delete all local
          app data
        </label>
        <div class="right">
          <v-ons-button @click="doLogout">Logout</v-ons-button>
        </div>
      </ons-list-item>
      <ons-list-item>
        <label class="center">
          View onboarder again
        </label>
        <div class="right">
          <v-ons-button @click="handleResetOnboarderClick"
            >Show now</v-ons-button
          >
        </div>
      </ons-list-item>
      <ons-list-item>
        <label class="center">
          Refresh iNaturalist profile
        </label>
        <div class="right">
          <v-ons-button @click="doInatProfileRefresh">Refresh</v-ons-button>
        </div>
      </ons-list-item>
      <ons-list-item>
        <label class="center">
          Check for app update now
        </label>
        <div class="right">
          <v-ons-button @click="doManualUpdateCheck">Check</v-ons-button>
        </div>
      </ons-list-item>
      <ons-list-item>
        <label class="center">
          When to sync with server
        </label>
        <div class="right">
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
      </ons-list-item>
    </v-ons-list>
  </v-ons-page>
</template>

<script>
import { mapState } from 'vuex'
import { deleteAllDatabases } from '@/indexeddb/dexie-store'
import { alwaysUpload, neverUpload } from '@/misc/constants'

export default {
  name: 'Settings',
  data() {
    return {
      whenToSyncOptions: [
        // FIXME support more options: only WiFi
        { value: alwaysUpload, label: 'Always' },
        { value: neverUpload, label: 'Never' },
      ],
    }
  },
  computed: {
    ...mapState('obs', ['localQueueSummary']),
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
  },
  mounted() {
    this.$store.commit('app/setTopTitle', 'Settings')
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
      this.$ons.notification.toast('Onboarder reset', {
        timeout: 1000,
        animation: 'ascend',
      })
      window.location.reload()
    },
    doLogout() {
      const msgFragment = (() => {
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
      const msg =
        `Are you sure? All data for this app will be deleted! ` + msgFragment
      this.$ons.notification.confirm(msg).then(isConfirmed => {
        if (!isConfirmed) {
          this.$ons.notification.toast('Wipe cancelled', {
            timeout: 1000,
            animation: 'ascend',
          })
          return
        }
        this.$store.dispatch('auth/doLogout')
        clearLocalStorage()
        unregisterAllServiceWorkers()
        deleteAllDatabases()
        this.$ons.notification
          .alert(
            'Logged out and all data wiped, press ok to restart the app in a clean state',
          )
          .then(() => {
            window.location.reload()
          })
      })
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
  },
}

function clearLocalStorage() {
  const keys = Object.keys(localStorage)
  console.debug(`Clearing localStorage of ${keys.length} keys`)
  for (const curr of keys) {
    localStorage.removeItem(curr)
  }
}

// thanks https://love2dev.com/blog/how-to-uninstall-a-service-worker/
function unregisterAllServiceWorkers() {
  navigator.serviceWorker.getRegistrations().then(regs => {
    console.debug(`Unregistering ${regs.length} service workers`)
    for (const curr of regs) {
      curr.unregister()
    }
  })
}
</script>
