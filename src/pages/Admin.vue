<template>
  <menu-wrapper title="Admin">
    <v-ons-card>
      <div class="title">
        Connect to RemoteJS (<a href="https://remotejs.com/" target="_blank"
          >remotejs.com</a
        >)
      </div>
      <div>
        <label for="remotejs-session-uuid">RemoteJS session UUID:</label>
        <v-ons-input
          v-model="remoteJsUuid"
          input-id="remotejs-session-uuid"
          placeholder="e.g: aa43a970-44c8-88df-a5bd-d5cb0687fdaf"
        ></v-ons-input>
      </div>
      <p>
        <v-ons-button @click="attachRemoteJs">Attach</v-ons-button>
      </p>
      <p class="mono">
        {{ remoteJsAttachStatus }}
      </p>
    </v-ons-card>
    <v-ons-card>
      <div class="title">Clone an obs N times</div>
      <p>
        Ever wondered if 30 local observations will bring a device to its knees?
        Find out. You might want to turn off syncing before cloning.
      </p>
      <div>
        <v-ons-button @click="prepCloneList"
          >Get list of cloneable obs</v-ons-button
        >
      </div>
      <div>
        Obs to clone
        <select v-model="cloneSubjectUuid">
          <option v-for="curr of cloneList" :key="curr.uuid" :value="curr.uuid">
            {{ curr.title }}
          </option>
        </select>
      </div>
      <div>
        Number of times to clone
        <input v-model="cloneCount" type="number" />
      </div>
      <div>
        <v-ons-button @click="doClone">Clone</v-ons-button>
      </div>
      <div>Status = {{ cloneStatus }}</div>
    </v-ons-card>
    <wow-force-rpo />
    <v-ons-card>
      <div class="title">Dump vuex</div>
      <p>
        <v-ons-checkbox v-model="isIncludeProject" input-id="include-project">
        </v-ons-checkbox>
        <label for="include-project"> Include project details </label>
      </p>
      <p>
        <v-ons-checkbox
          v-model="isIncludeLocalObs"
          input-id="include-local-obs"
        >
        </v-ons-checkbox>
        <label for="include-local-obs"> Include local observations </label>
      </p>
      <p>
        <v-ons-checkbox
          v-model="isIncludeRemoteObs"
          input-id="include-remote-obs"
        >
        </v-ons-checkbox>
        <label for="include-remote-obs"> Include remote observations </label>
      </p>
      <p>
        <v-ons-checkbox
          v-model="isIncludeSpeciesList"
          input-id="include-species-list"
        >
        </v-ons-checkbox>
        <label for="include-species-list"> Include species list </label>
      </p>
      <p>
        <v-ons-button @click="doVuexDump">Perform dump</v-ons-button>
      </p>
      <p>
        <v-ons-button @click="doCustomLocalQueueSummaryDump"
          >Dump only custom local queue summary</v-ons-button
        >
      </p>
      <div class="code-style">{{ vuexDump }}</div>
    </v-ons-card>
    <v-ons-card>
      <div class="title">Enable service worker console proxy</div>
      <p>
        For when you can't get access to the SW console. iOS Safari in
        BrowserStack is one offender.
      </p>
      <p>
        <v-ons-button
          :disabled="hasSwConsoleBeenProxied"
          @click="enableSwConsoleProxy"
        >
          <span v-if="!hasSwConsoleBeenProxied">Enable!</span>
          <span v-if="hasSwConsoleBeenProxied">Enabled :D</span>
        </v-ons-button>
      </p>
    </v-ons-card>
    <v-ons-card>
      <div class="title">Enable console proxying to UI</div>
      <p>For when you can't get access debug tools (like on a mobile device)</p>
      <p>
        <v-ons-button
          :disabled="hasConsoleBeenProxiedToUi"
          @click="enableConsoleProxyToUi"
        >
          <span v-if="!hasConsoleBeenProxiedToUi">Enable!</span>
          <span v-if="hasConsoleBeenProxiedToUi">Enabled :D</span>
        </v-ons-button>
      </p>
      <code>
        <pre
          v-for="curr of consoleMsgs"
          :key="curr.msg"
        ><span :class="'console-' + curr.level">[{{curr.level}}]</span> {{curr.msg}}</pre>
      </code>
      <p>
        <v-ons-button @click="clearConsole">Clear console</v-ons-button>
      </p>
    </v-ons-card>
    <v-ons-card>
      <div class="title">Location test</div>
      <div class="text-center">
        <p v-if="isLocSuccess" class="success-msg">
          Location: lat=<span class="mono">{{ lat }}</span
          >, lng=<span class="mono">{{ lng }}</span
          >, alt=<span class="mono">{{ alt }}</span
          >, acc=<span class="mono">{{ acc }}</span>
        </p>
        <p v-if="locErrorMsg" class="error-msg">{{ locErrorMsg }}</p>
        <v-ons-button name="get-location-btn" @click="getLocation"
          >Get location</v-ons-button
        >
      </div>
    </v-ons-card>
    <join-leave-project @refresh="doProjectInfoRefresh" />
    <wow-extract-thumbnail-from-exif />
    <wow-facade-migration-test />
    <wow-generate-crypto-keys />
    <wow-test-encrypt-payload />
    <wow-decrypt-payload />
    <v-ons-card>
      <div class="title">Platform test</div>
      <p>
        Run a series of tests to make sure the platform is working like we
        expect.
      </p>
      <pre><code>{{platformTestResult}}</code></pre>
      <v-ons-button @click="doPlatformTest">Do platform test</v-ons-button>
    </v-ons-card>
    <v-ons-card>
      <div class="title">User agent</div>
      <div class="text-center">
        {{ userAgent }}
      </div>
    </v-ons-card>
    <v-ons-card>
      <div class="title">Force refresh</div>
      <p>Project info last updated at: {{ projectInfoLastUpdatedPretty }}</p>
      <p>
        <v-ons-button @click="doProjectInfoRefresh"
          >Get fresh project info now</v-ons-button
        >
      </p>
      <p>User details last updated at: {{ userDetailsLastUpdatedPretty }}</p>
      <p>
        <v-ons-button @click="doUserDetailsRefresh"
          >Get fresh user details now</v-ons-button
        >
      </p>
    </v-ons-card>
    <v-ons-card>
      <div class="title">
        Clear localStorage and IDB; unregister service worker
      </div>
      <p>
        Useful during dev for browsers that don't have a nice clear for a single
        site, plus you don't have to logout
      </p>
      <p>
        <v-ons-button @click="resetDuringDev">Reset</v-ons-button>
      </p>
    </v-ons-card>
    <configuration-dump />
    <v-ons-card>
      <div class="title">Manually trigger an error</div>
      <p>
        <v-ons-input
          v-model="manualErrorMsg"
          placeholder="Error message here... (only used for main thread)"
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
        <v-ons-button @click="doManualError"
          >Trigger error in main thread</v-ons-button
        >
      </p>
    </v-ons-card>
    <v-ons-card>
      <v-ons-button @click="doCommunityWorkflow"
        >Community workflow</v-ons-button
      >
    </v-ons-card>
    <v-ons-card>
      <div class="title">ML Test</div>
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
  </menu-wrapper>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import uuid from 'uuid/v1'
import _ from 'lodash'
import * as Comlink from 'comlink'

import CommunityComponent from '@/pages/new-obs/Community'
import { mainStack } from '@/misc/nav-stacks'
import * as cc from '@/misc/constants'
import {
  clearLocalStorage,
  humanDateString,
  unregisterAllServiceWorkers,
} from '@/misc/helpers'
import * as devHelpers from '@/misc/dev-helpers'
import { deleteKnownStorageInstances } from '@/indexeddb/storage-manager'
import { getWebWorker } from '@/misc/web-worker-manager'

const wowModelPath = '/image-ml/v1/model.json'

export default {
  name: 'WowAdmin',
  data() {
    return {
      lat: null,
      lng: null,
      alt: null,
      locErrorMsg: null,
      vuexDump: '(nothing yet)',
      isIncludeLocalObs: false,
      isIncludeRemoteObs: false,
      isIncludeSpeciesList: false,
      isIncludeProject: false,
      manualErrorMsg: null,
      isManualErrorCaught: true,
      imageClassificationResult: 'nothing yet',
      classifier: null,
      ourWorker: null,
      hasConsoleBeenProxiedToUi: false,
      obsPhotoReqOutcome: 'nothing yet',
      hasSwConsoleBeenProxied: false,
      cloneList: [],
      cloneCount: 30,
      cloneSubjectUuid: null,
      cloneStatus: 'not started',
      remoteJsUuid: null,
      platformTestResult: '(not run yet)',
      remoteJsAttachStatus: '(no connection attempted, yet)',
    }
  },
  computed: {
    ...mapGetters('auth', ['isUserLoggedIn']),
    ...mapState('ephemeral', ['consoleMsgs']),
    isLocSuccess() {
      return this.lat && this.lng && !this.locErrorMsg
    },
    projectInfoLastUpdatedPretty() {
      const luDate = this.$store.state.obs.projectInfoLastUpdated
      return humanDateString(luDate || 0)
    },
    userDetailsLastUpdatedPretty() {
      const luDate = this.$store.state.auth.userDetailsLastUpdated
      return humanDateString(luDate || 0)
    },
    userAgent() {
      return (window.navigator || { userAgent: '(no window.navigator)' })
        .userAgent
    },
  },
  methods: {
    doCustomLocalQueueSummaryDump() {
      this.vuexDump = JSON.stringify(
        this.$store.state.obs.localQueueSummary,
        null,
        2,
      )
    },
    doVuexDump() {
      const parsed = _.cloneDeep(this.$store.state)
      if (!this.isIncludeLocalObs) {
        parsed.obs.localQueueSummary = `(excluded, ${parsed.obs.localQueueSummary.length} item array)`
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
      await this.loadMl5Library()
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
        (loc) => {
          this.lat = loc.coords.latitude
          this.lng = loc.coords.longitude
          this.alt = loc.coords.altitude
          this.acc = loc.coords.accuracy
        },
        (err) => {
          const msg = 'Location access is failed. '
          console.error(msg, err)
          this.locErrorMsg = msg + err.message
        },
        {
          timeout: 5000, // milliseconds
          enableHighAccuracy: this.isEnableHighAccuracy,
        },
      )
    },
    doCommunityWorkflow() {
      mainStack.push(CommunityComponent) // FIXME change to using router
    },
    doManualError() {
      const err = new Error(
        `[Manually triggered error from /admin] ${this.manualErrorMsg}`,
      )
      err.httpStatus = 418
      err.name = 'ManuallyTriggeredError'
      if (!this.isManualErrorCaught) {
        throw err
      }
      this.$wow.uiTrace('Admin', 'manual error trigger')
      this.$store.dispatch(
        'flagGlobalError',
        {
          msg: `Handling manually thrown error with our code`,
          err,
        },
        { root: true },
      )
    },
    _sendMessageToSw(msg) {
      return new Promise(function (resolve, reject) {
        const msgChan = new MessageChannel()
        msgChan.port1.onmessage = function (event) {
          if ((event.data || {}).error) {
            return reject(event.data.error)
          }
          return resolve(event.data)
        }
        const { controller } = navigator.serviceWorker
        if (!controller) {
          reject(new Error(`No service worker active. Cannot send msg=${msg}`))
          return
        }
        controller.postMessage(msg, [msgChan.port2])
      })
    },
    async doProjectInfoRefresh() {
      await this.$store.dispatch('obs/getProjectInfo')
    },
    async doUserDetailsRefresh() {
      await this.$store.dispatch('auth/updateUserDetails')
    },
    async enableSwConsoleProxy() {
      this.hasSwConsoleBeenProxied = true
      const reg = this.$store.state.ephemeral.swReg
      if (!reg) {
        throw new Error('No SW registration found, cannot send message')
      }
      reg.active.postMessage(cc.proxySwConsoleMsg)
      console.log('Message sent to SW to enable console proxying')
    },
    enableConsoleProxyToUi() {
      const origConsole = {}
      for (const curr of ['debug', 'info', 'warn', 'error']) {
        origConsole[curr] = console[curr]
        console[curr] = (...theArgs) => {
          const simpleMsg = theArgs.reduce((accum, curr2) => {
            return `${accum}${curr2} ` // TODO do we need to handle Errors or objects specially?
          }, '')
          this.$store.commit('ephemeral/pushConsoleMsg', {
            level: curr,
            msg: simpleMsg,
          })
          origConsole[curr](...theArgs) // still log to the devtools console
        }
      }
      this.hasConsoleBeenProxiedToUi = true
      origConsole.debug(
        'Console has been proxied to UI. You should see this *only* in the console, not the UI',
      )
      console.debug(
        'Console has been proxied to UI. You should see this in the *UI* and the console',
      )
    },
    clearConsole() {
      this.$store.commit('ephemeral/clearConsoleMsgs')
    },
    async resetDuringDev() {
      clearLocalStorage()
      unregisterAllServiceWorkers()
      await deleteKnownStorageInstances()
    },
    async doClone() {
      this.cloneStatus = 'Starting'
      console.debug(
        `Cloning obs UUID=${this.cloneSubjectUuid} a count of ${this.cloneCount} times`,
      )
      const ww = getWebWorker()
      const cloneSubject = await ww.getRecord(this.cloneSubjectUuid)
      let counter = 0
      while (counter < this.cloneCount) {
        counter += 1
        const msg = `Making clone #${counter}`
        console.debug(msg)
        this.cloneStatus = msg
        const cloned = {
          ...cloneSubject,
          speciesGuess: `[Clone ${counter}] ${cloneSubject.speciesGuess}`,
          uuid: uuid(),
          observedAt: new Date(),
        }
        await ww.storeRecord(cloned)
      }
      await this.$store.dispatch('obs/refreshLocalRecordQueue')
      this.cloneStatus = 'Done :D'
    },
    prepCloneList() {
      this.cloneList = this.$store.getters['obs/localRecords'].map((e) => ({
        title: `${e.speciesGuess}  ${e.uuid}  ${e.observedAt}`,
        uuid: e.uuid,
      }))
    },
    async attachRemoteJs() {
      console.debug('attaching to RemoteJS')
      this.remoteJsAttachStatus = 'attaching...'
      const theUuid = this.remoteJsUuid
      if (!theUuid) {
        // eslint-disable-next-line no-alert
        alert('You must supply the UUID for the RemoteJS session')
        return
      }
      const scriptTagId = 'remotejs-script'
      const existingScript = document.getElementById(scriptTagId)
      if (existingScript) {
        console.debug('removing existing RemoteJS script')
        existingScript.remove()
      }
      const s = document.createElement('script')
      s.src = 'https://remotejs.com/agent/agent.js'
      s.id = scriptTagId
      s.setAttribute('data-consolejs-channel', theUuid)
      document.head.appendChild(s)
      if (!this.hasSwConsoleBeenProxied) {
        try {
          await this.enableSwConsoleProxy()
        } catch (err) {
          this.remoteJsAttachStatus = `attached but SW console proxy failed: ${err.message}`
          return
        }
      }
      this.remoteJsAttachStatus = 'attached and SW console proxied'
    },
    async doPlatformTest() {
      try {
        this.platformTestResult = [
          {
            name: 'platformTestReqFileMainThread',
            result: await devHelpers.platformTestReqFile(),
          },
          {
            name: 'platformTestReqBlobMainThread',
            result: await devHelpers.platformTestReqBlob(),
          },
        ]
      } catch (err) {
        console.error('Failed to perform platform test', err)
        this.platformTestResult = `Failed. ${err.message}`
      }
    },
    async loadMl5Library() {
      const src = 'https://unpkg.com/ml5@0.5.0/dist/ml5.min.js'
      // ML5 is huge! And we're not using it in production code yet. So to keep
      // bundle sizes down, we just pull it from CDN. When we do start using it,
      // remove all this DOM hackery and just stick the follow line up with the
      // other imports:
      //   import { imageClassifier as ml5ImageClassifier } from 'ml5/dist/ml5'
      return new Promise((resolve, reject) => {
        try {
          if (isScriptAlreadyLoaded(src)) {
            console.debug('ML5 already loaded')
            resolve()
            return
          }
          // thanks https://stackoverflow.com/a/47002863/1410035
          const ml5Script = document.createElement('script')
          ml5Script.setAttribute('src', src)
          ml5Script.async = true
          ml5Script.onload = () => {
            console.log('ML5 external script loaded')
            this.classifier = window.ml5.imageClassifier(
              wowModelPath,
              this.modelReady,
            )
            const worker = new Worker('./classificationWorker.js', {
              type: 'module',
            })
            this.ourWorker = Comlink.wrap(worker)
            resolve()
          }
          document.head.appendChild(ml5Script)
        } catch (err) {
          reject(err)
        }
      })
    },
  },
}

function isScriptAlreadyLoaded(src) {
  for (const curr of document.head.children) {
    if (curr.src === src) {
      return true
    }
  }
  return false
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

.config-item-value {
  font-family: monospace;
  overflow: auto;
}

.footer-whitespace {
  height: 100vh;
}

.console-error {
  font-weight: bold;
  color: red;
}

.console-warn {
  font-weight: bold;
  color: orange;
}

.gimme-some-space {
  margin-top: 1em;
}

.wow-admin-list-header {
  text-transform: none;
}
</style>
