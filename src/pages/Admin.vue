<template>
  <v-ons-page>
    <custom-toolbar back-label="Cancel" title="Admin"></custom-toolbar>
    <v-ons-card>
      <div class="title">
        Storage stats
      </div>
      <p>
        <v-ons-progress-bar
          :value="storageUsedPercent"
          :secondary-value="100"
        ></v-ons-progress-bar>
      </p>
      <div>
        {{ storageMsg }}
      </div>
    </v-ons-card>
    <v-ons-card>
      <div class="title">
        Location test
      </div>
      <div class="text-center">
        <p v-if="isLocSuccess" class="success-msg">
          Location: lat=<span class="mono">{{ lat }}</span
          >, lng=<span class="mono">{{ lng }}</span>
        </p>
        <p v-if="locErrorMsg" class="error-msg">{{ locErrorMsg }}</p>
        <v-ons-button @click="getLocation">Get location</v-ons-button>
      </div>
    </v-ons-card>
    <v-ons-card>
      <div>Logged in = {{ isUserLoggedIn }}</div>
      <div>
        Do this first
        <v-ons-button @click="doLogin">Login</v-ons-button>
      </div>
      <div>
        Then make the call...
        <v-ons-button @click="doGetUserDetails"
          >Test API call to /users/me</v-ons-button
        >
        <div style="font-family: monospace; white-space: pre;">
          Result = {{ meResp }}
        </div>
      </div>
    </v-ons-card>
    <v-ons-card>
      <v-ons-button @click="doManualUpdateCheck"
        >Check for SW update</v-ons-button
      >
    </v-ons-card>
    <v-ons-card>
      <v-ons-button @click="doCommunityWorkflow"
        >Community workflow</v-ons-button
      >
    </v-ons-card>
  </v-ons-page>
</template>

<script>
import { mapGetters } from 'vuex'

import { getJsonWithAuth } from '@/misc/helpers'
import { inatUrlBase, appId, redirectUri, apiUrlBase } from '@/misc/constants'
import CommunityComponent from '@/pages/new-obs/Community'

export default {
  data() {
    return {
      lat: null,
      lng: null,
      locErrorMsg: null,
      storageQuota: 0,
      storageUsage: 0,
      storageUsedPercent: 0,
      meResp: '(nothing yet)',
    }
  },
  computed: {
    ...mapGetters('auth', ['isUserLoggedIn']),
    isLocSuccess() {
      return this.lat && this.lng && !this.locErrorMsg
    },
    storageMsg() {
      const quotaMb = twoDecimalPlaces(this.storageQuota / 1000 / 1000)
      const usageMb = twoDecimalPlaces(this.storageUsage / 1000 / 1000)
      return `Used ${usageMb}MB of ${quotaMb}MB (${this.storageUsedPercent}%)`
    },
  },
  created() {
    this.updateStorageStats()
  },
  methods: {
    async updateStorageStats() {
      const estimate = await navigator.storage.estimate()
      this.storageQuota = estimate.quota
      this.storageUsage = estimate.usage
      const usedPercentRaw = (this.storageUsage / this.storageQuota) * 100
      this.storageUsedPercent = twoDecimalPlaces(
        isNaN(usedPercentRaw) ? 0 : usedPercentRaw,
      )
    },
    getLocation() {
      this.locErrorMsg = null
      if (!navigator.geolocation) {
        this.locErrorMsg = 'User agent does not seem to support location'
        return
      }
      navigator.geolocation.getCurrentPosition(
        loc => {
          this.lat = loc.coords.latitude
          this.lng = loc.coords.longitude
        },
        () => {
          this.locErrorMsg = 'Location access is blocked'
        },
      )
    },
    doLogin() {
      this.$store.dispatch('auth/generatePkcePair')
      const challenge = this.$store.state.auth.code_challenge
      location.assign(
        `${inatUrlBase}/oauth/authorize?
        client_id=${appId}&
        redirect_uri=${redirectUri}&
        code_challenge=${challenge}&
        code_challenge_method=S256&
        response_type=code`.replace(/\s/g, ''),
      )
    },
    async doGetUserDetails() {
      try {
        const resp = await getJsonWithAuth(
          `${apiUrlBase}/users/me`,
          this.$store.state.auth.apiToken,
        )
        this.meResp = resp
      } catch (err) {
        console.error('Failed to make /users/me API call', err)
        return
      }
    },
    doManualUpdateCheck() {
      this.$store
        .dispatch('app/manualServiceWorkerUpdateCheck')
        .then(isChecking => {
          if (isChecking) {
            this.$ons.notification.toast('Checking for updates', {
              timeout: 3000,
              animation: 'ascend',
            })
            return
          }
          this.$ons.notification.toast('No SWReg, cannot check', {
            timeout: 3000,
            animation: 'ascend',
          })
        })
    },
    doCommunityWorkflow() {
      this.$store.commit('navigator/push', CommunityComponent)
    },
  },
}

function twoDecimalPlaces(v) {
  return +v.toFixed(2)
}
</script>

<style scoped>
.success-msg {
  color: green;
}

.error-msg {
  color: red;
}

.mono {
  font-family: monospace;
}
</style>
