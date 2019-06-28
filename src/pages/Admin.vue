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
      <router-link :to="{ name: 'OauthCallback' }"
        >Jump to OAuth callback</router-link
      >
    </v-ons-card>
    <v-ons-card>
      <v-ons-button @click="doLogin">Login</v-ons-button>
    </v-ons-card>
  </v-ons-page>
</template>

<script>
import { inatUrlBase, appId, redirectUri } from '@/misc/constants'

export default {
  data() {
    return {
      lat: null,
      lng: null,
      locErrorMsg: null,
      storageQuota: 0,
      storageUsage: 0,
      storageUsedPercent: 0,
    }
  },
  computed: {
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
      // FIXME OAuth screen on iNat isn't mobile friendly/responsive
      location.assign(
        `${inatUrlBase}/oauth/authorize?
        client_id=${appId}&
        redirect_uri=${redirectUri}&
        response_type=token`.replace(/\s/g, ''),
      )
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
