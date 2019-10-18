<template>
  <v-ons-page>
    <custom-toolbar back-label="Cancel" title="Admin"></custom-toolbar>
    <v-ons-card>
      <div class="title">
        Location test
      </div>
      <div class="text-center">
        <p v-if="isLocSuccess" class="success-msg">
          Location: lat=<span class="mono">{{ lat }}</span
          >, lng=<span class="mono">{{ lng }}</span
          >, alt=<span class="mono">{{ alt }}</span
          >, acc=<span class="mono">{{ acc }}</span>
        </p>
        <p v-if="locErrorMsg" class="error-msg">{{ locErrorMsg }}</p>
        <v-ons-button @click="getLocation">Get location</v-ons-button>
      </div>
    </v-ons-card>
    <v-ons-card>
      <div class="title">
        Is Dexie DB open?
      </div>
      <p class="mono">
        <strong>Result = {{ isDbOpen }}</strong>
      </p>
      <p>
        Note: we lazy open the DB on first use so if you navigate directly to
        this page, it might have not opened yet. Don't panic!
      </p>
    </v-ons-card>
    <v-ons-card>
      <div class="title">
        Service Worker statuses
      </div>
      <p class="mono">
        <span v-if="isSwActive" class="success-msg">All ready to go!</span>
        <span v-if="!isSwActive" class="error-msg"
          >SW is either not ready or not supported :(</span
        >
      </p>
      <p class="mono">
        <strong>Active = {{ swStatus.active }}</strong
        ><br />
        <strong>Installing = {{ swStatus.installing }}</strong
        ><br />
        <strong>Waiting = {{ swStatus.waiting }}</strong>
      </p>
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
        Trigger queue processing
      </div>
      <div>
        <v-ons-button @click="doLQP">Trigger</v-ons-button>
      </div>
    </v-ons-card>
    <v-ons-card>
      <div class="standalone-title">
        Configuration
      </div>
      <v-ons-list>
        <template v-for="curr of configItems">
          <v-ons-list-header
            :key="curr.label + '-header'"
            class="wow-list-header"
          >
            {{ curr.label }}
          </v-ons-list-header>
          <v-ons-list-item
            :key="curr.label + '-value'"
            class="config-item-value"
          >
            {{ curr.value }}
          </v-ons-list-item>
        </template>
      </v-ons-list>
    </v-ons-card>
    <v-ons-card>
      <div class="title">
        Dump vuex from localStorage
      </div>
      <p>
        <v-ons-checkbox v-model="isIncludeProject" input-id="include-project">
        </v-ons-checkbox>
        <label for="include-project">
          Include project details
        </label>
      </p>
      <p>
        <v-ons-checkbox
          v-model="isIncludeLocalObs"
          input-id="include-local-obs"
        >
        </v-ons-checkbox>
        <label for="include-local-obs">
          Include local observations
        </label>
      </p>
      <p>
        <v-ons-checkbox
          v-model="isIncludeRemoteObs"
          input-id="include-remote-obs"
        >
        </v-ons-checkbox>
        <label for="include-remote-obs">
          Include remote observations
        </label>
      </p>
      <p>
        <v-ons-checkbox
          v-model="isIncludeSpeciesList"
          input-id="include-species-list"
        >
        </v-ons-checkbox>
        <label for="include-species-list">
          Include species list
        </label>
      </p>
      <p>
        <v-ons-button @click="doVuexDump">Perform dump</v-ons-button>
      </p>
      <div class="code-style">{{ vuexDump }}</div>
    </v-ons-card>
    <v-ons-card>
      <div class="title">
        Manually trigger an error
      </div>
      <p>
        <v-ons-input
          v-model="manualErrorMsg"
          placeholder="Error message here..."
        >
        </v-ons-input>
      </p>
      <p>
        <v-ons-checkbox
          v-model="isManualErrorCaught"
          input-id="is-manual-error-caught"
        >
        </v-ons-checkbox>
        <label for="is-manual-error-caught">
          Catch and handle error (or let bubble to the top)
        </label>
      </p>

      <p>
        <v-ons-button @click="doManualError">Trigger error</v-ons-button>
      </p>
    </v-ons-card>
    <v-ons-card>
      <v-ons-button @click="doCommunityWorkflow"
        >Community workflow</v-ons-button
      >
    </v-ons-card>
    <div class="footer-whitespace"></div>
  </v-ons-page>
</template>

<script>
import { mapGetters } from 'vuex'
import _ from 'lodash'

import CommunityComponent from '@/pages/new-obs/Community'
import { mainStack } from '@/misc/nav-stacks'
import * as constants from '@/misc/constants'
import { isDbOpen } from '@/indexeddb/dexie-store'

export default {
  data() {
    return {
      lat: null,
      lng: null,
      alt: null,
      locErrorMsg: null,
      meResp: '(nothing yet)',
      vuexDump: '(nothing yet)',
      isIncludeLocalObs: false,
      isIncludeRemoteObs: false,
      isIncludeSpeciesList: false,
      isIncludeProject: false,
      configItems: [],
      manualErrorMsg: null,
      isManualErrorCaught: true,
      isDbOpen: '(not checked yet)',
    }
  },
  computed: {
    ...mapGetters('auth', ['isUserLoggedIn']),
    ...mapGetters('ephemeral', ['swStatus', 'isSwActive']),
    isLocSuccess() {
      return this.lat && this.lng && !this.locErrorMsg
    },
  },
  created() {
    this.computeConfigItems()
    this.isDbOpen = isDbOpen()
  },
  methods: {
    doLQP() {
      this.$store.dispatch('obs/processLocalQueue')
    },
    computeConfigItems() {
      const nonSecretKeys = [
        'appVersion',
        'deployedEnvName',
        'inatProjectSlug',
        'inatStaticUrlBase',
        'inatUrlBase',
        'obsFieldSeparatorChar',
        'redirectUri',
      ]
      const partialResult = nonSecretKeys.map(e => ({
        label: e,
        value: constants[e],
      }))
      const result = [
        ...partialResult,
        { label: 'obsFieldPrefix', value: `"${constants.obsFieldPrefix}"` },
        { label: 'appId', value: constants.appId.replace(/.{35}/, '(snip)') },
        {
          label: 'googleMapsApiKey',
          value: (v => v.replace(new RegExp(`.{${v.length - 4}}`), '(snip)'))(
            constants.googleMapsApiKey,
          ),
        },
        {
          label: 'sentryDsn',
          value: constants.sentryDsn.replace(/.{25}/, '(snip)'),
        },
      ]
      result.sort((a, b) => {
        if (a.label < b.label) return -1
        if (a.label > b.label) return 1
        return 0
      })
      this.configItems = result
    },
    doVuexDump() {
      const parsed = _.cloneDeep(this.$store.state)
      if (!this.isIncludeLocalObs) {
        parsed.obs._uiVisibleLocalRecords = `(excluded, ${
          parsed.obs._uiVisibleLocalRecords.length
        } item array)`
      }
      if (!this.isIncludeRemoteObs) {
        parsed.obs.allRemoteObs = `(excluded, ${
          parsed.obs.allRemoteObs.length
        } item array)`
      }
      if (!this.isIncludeProject) {
        parsed.obs.projectInfo = '(excluded)'
      }
      if (!this.isIncludeSpeciesList) {
        parsed.obs.mySpecies = `(excluded, ${
          parsed.obs.mySpecies.length
        } item array)`
      }
      this.vuexDump = JSON.stringify(parsed, null, 2)
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
          this.alt = loc.coords.altitude
          this.acc = loc.coords.accuracy
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
    doManualError() {
      const err = new Error(
        '[Manually triggered error from /admin] ' + this.manualErrorMsg,
      )
      err.httpStatus = 418
      err.name = 'ManuallyTriggeredError'
      if (!this.isManualErrorCaught) {
        throw err
      }
      this.$store.dispatch(
        'flagGlobalError',
        {
          msg: `Handling manually thrown error with our code`,
          err,
        },
        { root: true },
      )
    },
  },
}
</script>

<style lang="scss" scoped>
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

.standalone-title {
  font-size: 1.5em;
}

.config-item-value {
  font-family: monospace;
  overflow: auto;
}

.footer-whitespace {
  height: 100vh;
}
</style>
