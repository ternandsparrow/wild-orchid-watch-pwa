<template>
  <v-ons-page>
    <custom-toolbar back-label="Cancel" title="Admin robin"></custom-toolbar>
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
        Is currently processing queue?
      </div>
      <p class="mono">
        <strong>Result = {{ isProcessingQueue }}</strong>
      </p>
    </v-ons-card>
    <v-ons-card>
      <div class="title">
        Service Worker statuses
      </div>
      <p class="mono">
        <span v-if="isSwStatusActive" class="success-msg"
          >All ready to go!</span
        >
        <span v-if="!isSwStatusActive" class="error-msg"
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
      <p><button @click="fireCheckSwCall">Fire check to SW</button></p>
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
        Force refresh project info
      </div>
      <p>Project info last updated at: {{ projectInfoLastUpdatedPretty }}</p>
      <p>
        <v-ons-button @click="doProjectInfoRefresh"
          >Get fresh project info now</v-ons-button
        >
      </p>
    </v-ons-card>
    <v-ons-card>
      <div class="title">
        Trigger queue processing
      </div>
      <div>
        <v-ons-button @click="doLQP"
          >Trigger local (client) queue processing</v-ons-button
        >
      </div>
      <p>
        Beware of these two SW triggers. If the queue is already processing,
        it'll start double processing. There's no safe guard. These status
        reports are only for manually triggered processing, they have no idea
        about workbox-triggered processing.
      </p>
      <div>
        <p>Manually triggered processing status = {{ swObsQueueStatus }}</p>
        <v-ons-button @click="triggerSwObsQueue"
          >Trigger SW obs queue processing</v-ons-button
        >
      </div>
      <div>
        <p>Manually triggered processing status = {{ swDepsQueueStatus }}</p>
        <v-ons-button @click="triggerSwDepsQueue"
          >Trigger SW deps queue processing</v-ons-button
        >
      </div>
    </v-ons-card>
    <v-ons-card>
      <div class="title">
        Service Worker health check
      </div>
      <p>
        <v-ons-button @click="doSwHealthCheck">Perform check</v-ons-button>
      </p>
      <div class="code-style">{{ swHealthCheckResult }}</div>
    </v-ons-card>
    <v-ons-card>
      <div class="title">
        Enable service worker console proxy
      </div>
      <p>
        For when you can't get access to the SW console. iOS Safari in
        BrowserStack is one offender.
      </p>
      <p>
        <v-ons-button @click="enableSwConsoleProxy">Enable!</v-ons-button>
      </p>
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
        Dump vuex
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
    <v-ons-card>
      <div class="title">
        ML Test
      </div>
      <p>
        Load the Trained Model, Load a test Image and then do a predict on the
        image.
      </p>
      <img
        id="imageToClassify"
        src="img/help/orchid-type-terrestrial.jpg"
        alt="Onsen UI"
        style="width: 100%"
      />
      <v-ons-button @click="doImageClassification"
        >Perform classification</v-ons-button
      >
      <div class="code-style">{{ imageClassificationResult }}</div>
    </v-ons-card>
    <div class="footer-whitespace"></div>
  </v-ons-page>
</template>

<script>
import { mapGetters } from 'vuex'
import moment from 'moment'
import _ from 'lodash'
import ml5 from 'ml5'
import * as Comlink from 'comlink'

import CommunityComponent from '@/pages/new-obs/Community'
import { mainStack } from '@/misc/nav-stacks'
import * as constants from '@/misc/constants'
import { isSwActive } from '@/misc/helpers'

const wowModelPath = '/image-ml/v1/model.json'

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
      swObsQueueStatus: 'not started',
      swDepsQueueStatus: 'not started',
      imageClassificationResult: 'nothing yet',
      classifier: null,
      ourWorker: null,
      swHealthCheckResult: 'nothing yet',
    }
  },
  computed: {
    ...mapGetters('auth', ['isUserLoggedIn']),
    ...mapGetters('ephemeral', ['swStatus', 'isSwStatusActive']),
    isLocSuccess() {
      return this.lat && this.lng && !this.locErrorMsg
    },
    isProcessingQueue() {
      return !!this.$store.state.ephemeral.queueProcessorPromise
    },
    projectInfoLastUpdatedPretty() {
      const luDate = this.$store.state.obs.projectInfoLastUpdated
      return moment(luDate || 0)
    },
  },
  created() {
    this.computeConfigItems()
    this.classifier = ml5.imageClassifier(wowModelPath, this.modelReady)
    const worker = new Worker('./classificationWorker.js', { type: 'module' })
    this.ourWorker = Comlink.wrap(worker)
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
    async doSwHealthCheck() {
      this.swHealthCheckResult = 'nothing yet'
      try {
        const resp = await fetch(constants.serviceWorkerHealthCheckUrl)
        this.swHealthCheckResult = await resp.json()
      } catch (err) {
        this.swHealthCheckResult = err.message
        console.error('Failed to do health check on service worker', err)
      }
    },
    doVuexDump() {
      const parsed = _.cloneDeep(this.$store.state)
      if (!this.isIncludeLocalObs) {
        parsed.obs._uiVisibleLocalRecords = `(excluded, ${parsed.obs._uiVisibleLocalRecords.length} item array)`
      }
      if (!this.isIncludeRemoteObs) {
        parsed.obs.allRemoteObs = `(excluded, ${parsed.obs.allRemoteObs.length} item array)`
      }
      if (!this.isIncludeProject) {
        parsed.obs.projectInfo = '(excluded)'
      }
      if (!this.isIncludeSpeciesList) {
        parsed.obs.mySpecies = `(excluded, ${parsed.obs.mySpecies.length} item array)`
      }
      this.vuexDump = JSON.stringify(parsed, null, 2)
    },
    async doImageClassification() {
      console.log(`Counter before: ${await this.ourWorker.counter}`)
      await this.ourWorker.inc()
      console.log(`Counter after: ${await this.ourWorker.counter}`)
      // Make a prediction with a selected image
      this.classifier.classify(
        // FIXME how do we pass the image to the worker? ML5 seems to want
        // references to images but web workers don't have access to the DOM.
        // Ideally we could pass the bytes themselves but even then, we can't
        // create HTMLImageElement, etc in the worker. OffscreenCanvas might be
        // a solution but that doesn't have good enough browser support to be used
        // yet
        document.getElementById('imageToClassify'),
        (err, results) => {
          if (err) {
            console.error('Failed to run classifier', err)
          }
          this.imageClassificationResult = JSON.stringify(results, null, 2)
        },
      )
    },
    modelReady() {
      console.log('Model is loaded..')
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
        err => {
          const msg = 'Location access is failed. '
          console.error(msg, err)
          this.locErrorMsg = msg + err.message
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
    fireCheckSwCall() {
      isSwActive().then(result => {
        console.log('Is SW alive? ' + result)
      })
    },
    triggerSwObsQueue() {
      this.swObsQueueStatus = 'processing'
      this._sendMessageToSw(constants.syncObsQueueMsg)
        .then(() => {
          console.debug(
            'Triggering of SW obs queue processing completed successfully',
          )
          this.swObsQueueStatus = 'finished'
        })
        .catch(err => {
          this.swObsQueueStatus = 'error. ' + err
        })
    },
    triggerSwDepsQueue() {
      this.swDepsQueueStatus = 'processing'
      this._sendMessageToSw(constants.syncDepsQueueMsg)
        .then(() => {
          console.debug(
            'Triggering of SW deps queue processing completed successfully',
          )
          this.swDepsQueueStatus = 'finished'
        })
        .catch(err => {
          this.swDepsQueueStatus = 'error. ' + err
        })
    },
    _sendMessageToSw(msg) {
      return new Promise(function(resolve, reject) {
        const msgChan = new MessageChannel()
        msgChan.port1.onmessage = function(event) {
          if ((event.data || {}).error) {
            return reject(event.data.error)
          }
          return resolve(event.data)
        }
        const controller = navigator.serviceWorker.controller
        if (!controller) {
          return reject('No service worker active. Cannot send msg=' + msg)
        }
        controller.postMessage(msg, [msgChan.port2])
      })
    },
    async doProjectInfoRefresh() {
      await this.$store.dispatch('obs/getProjectInfo')
    },
    async enableSwConsoleProxy() {
      this.$store.state.ephemeral.swReg.active.postMessage(
        constants.proxySwConsoleMsg,
      )
      console.log('Message sent to SW to enable console proxying')
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
