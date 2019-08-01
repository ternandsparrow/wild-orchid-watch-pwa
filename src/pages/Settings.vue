<template>
  <v-ons-page>
    <v-ons-list>
      <v-ons-list-header
        >You can customise the WoW Field Data Collection App's settings
        here</v-ons-list-header
      >
      <ons-list-item>
        <label class="center">
          Logout from Wild Orchid Watch and iNaturalist
        </label>
        <div class="right">
          <v-ons-button @click="doLogout">Logout</v-ons-button>
        </div>
      </ons-list-item>
      <ons-list-item>
        <label class="center">
          Show onboarder next time the App launches
        </label>
        <div class="right">
          <v-ons-button @click="handleResetOnboarderClick">Reset</v-ons-button>
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
    </v-ons-list>
  </v-ons-page>
</template>

<script>
import { deleteAllDatabases } from '@/indexeddb/dexie-store'

export default {
  name: 'Settings',
  mounted() {
    this.$store.commit('app/setTopTitle', 'Settings')
  },
  methods: {
    handleResetOnboarderClick() {
      this.$store.commit('app/setIsFirstRun', true)
      this.$ons.notification.toast('Onboarder reset', {
        timeout: 1000,
        animation: 'ascend',
      })
    },
    doLogout() {
      // FIXME check if we have unsync'd observations and warn they'll be lost
      const msg =
        'Are you sure? All data will from this app will also be deleted.'
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
