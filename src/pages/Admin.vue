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
      <div class="title">
        Login test
      </div>
      <div>Logged in = {{ isUserLoggedIn }}</div>
      <div>
        Do this first
        <v-ons-button @click="doLogin">Login</v-ons-button>
      </div>
      <p>
        Then make the call...
        <v-ons-button @click="doGetUserDetails"
          >Test API call to /users/me</v-ons-button
        >
      </p>
      <div class="code-style">Result = {{ meResp }}</div>
    </v-ons-card>
    <v-ons-card>
      <div class="title">
        Dump vuex from localStorage
      </div>
      <p>
        <v-ons-checkbox input-id="include-obs" v-model="isIncludeObs">
        </v-ons-checkbox>
        <label for="include-obs">
          Include observations
        </label>
      </p>

      <p></p>
      <p>
        <v-ons-button @click="doVuexDump">Perform dump</v-ons-button>
      </p>
      <div class="code-style">{{ vuexDump }}</div>
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

import CommunityComponent from '@/pages/new-obs/Community'
import { mainStack } from '@/misc/nav-stacks'
import { persistedStateLocalStorageKey } from '@/misc/constants'

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
      vuexDump: '(nothing yet)',
      isIncludeObs: false,
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
    doVuexDump() {
      const rawDump = localStorage.getItem(persistedStateLocalStorageKey)
      const parsed = JSON.parse(rawDump)
      if (!this.isIncludeObs) {
        parsed.obs.myObs = `(excluded, ${parsed.obs.myObs.length} item array)`
      }
      this.vuexDump = JSON.stringify(parsed, null, 2)
    },
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
      this.$store.dispatch('auth/doLogin')
    },
    async doGetUserDetails() {
      const urlSuffix = '/users/me'
      try {
        const resp = await this.$store.dispatch('doApiGet', { urlSuffix })
        this.meResp = resp
      } catch (err) {
        console.error(`Failed to make ${urlSuffix} API call`, err)
        return
      }
    },
    doCommunityWorkflow() {
      mainStack.push(CommunityComponent) // FIXME change to using router
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

.code-style {
  font-family: monospace;
  white-space: pre;
}
</style>
