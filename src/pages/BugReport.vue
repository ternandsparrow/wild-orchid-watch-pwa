<template>
  <menu-wrapper title="Report Problem">
    <v-ons-card>
      <p>
        If you've found a problem with this app and want to report it to the
        maintainer, this is the place to do it.
      </p>
    </v-ons-card>
    <v-ons-card>
      <p>
        Tell us about the problem. The best bug reports include the following
        information:
      </p>
      <ul>
        <li>what steps you took to lead up to the problem</li>
        <li>what you <em>expected</em> to happen</li>
        <li>what <em>actually</em> happened</li>
      </ul>
      <p>
        These details are extremely useful because they let us reproduce the
        problem. If we can make the problem happen, we can also know when the
        problem is fixed.
      </p>
      <p>
        Example report (note: iNat doesn't support videos, this is just a
        contrived example):
      </p>
      <div>
        <pre>
        Steps:
        - open the app
        - open the "new observation" screen
        - tap the "whole plant" photo to select a file
        - select a video file from my phone

        Expected behaviour:
        The app accepts the video file.

        Actual behaviour:
        No file is shown and an error message appears
        saying "unhandled file type".
        </pre>
      </div>
      <p>
        <label>Report details:</label>
      </p>
      <p>
        <textarea v-model="bugComment" class="wow-textarea"></textarea>
      </p>
      <p v-if="reportState === 'success'" class="success-alert">
        Successfully reported
      </p>
      <p v-if="reportState === 'error'" class="error-alert">
        Failed to report
      </p>
      <p>
        <v-ons-button @click="sendBugReport">
          Send report
          <v-ons-icon
            v-if="reportState === 'processing'"
            icon="fa-spinner"
            spin
          ></v-ons-icon>
        </v-ons-button>
      </p>
    </v-ons-card>
    <v-ons-card>
      <p>
        <v-ons-button modifier="quiet" @click="showTechDetails">
          <span v-if="!techDetailsLastUpdated">
            Display
          </span>
          <span v-if="techDetailsLastUpdated">
            Refresh
          </span>
          technical details
        </v-ons-button>
      </p>
      <div v-if="techDetailsLastUpdated">
        <div><a :href="mailtoHref" target="_blank">Send via email</a></div>
        <p>
          Last updated: <code>{{ techDetailsLastUpdated }}</code>
        </p>
        <p>
          <strong>User agent</strong>
          <br />
          <code>{{ userAgent }}</code>
        </p>
        <strong>Service worker health check</strong>
        <pre><code>{{swHealthCheckResult}}</code></pre>
        <strong>Vuex store: app</strong>
        <pre><code>{{vuexStoreApp}}</code></pre>
        <strong>Vuex store: auth</strong>
        <pre><code>{{vuexStoreAuth}}</code></pre>
        <strong>Vuex store: ephemeral</strong>
        <pre><code>{{vuexStoreEphemeral}}</code></pre>
        <strong>Vuex store: obs</strong>
        <pre><code>{{vuexStoreObs}}</code></pre>
        <strong>Interesting constants/config</strong>
        <pre><code>{{interestingConstants}}</code></pre>
      </div>
    </v-ons-card>
  </menu-wrapper>
</template>

<script>
import { mapGetters } from 'vuex'
import * as gcpError from 'stackdriver-error-reporting-clientside-js-client'
import * as constants from '@/misc/constants'
import { isSwActive, chainedError } from '@/misc/helpers'

export default {
  name: 'BugReport',
  data() {
    return {
      bugComment: null,
      reportState: 'initial',
      reportFailureError: null,
      techDetailsLastUpdated: null,
      swHealthCheckResult: null,
      vuexStoreApp: null,
      vuexStoreAuth: null,
      vuexStoreEphemeral: null,
      vuexStoreObs: null,
      interestingConstants: null,
    }
  },
  computed: {
    ...mapGetters('auth', ['myUsername']),
    contextObj() {
      return {
        userAgent: this.userAgent,
        swHealthCheckResult: this.swHealthCheckResult,
        vuexStoreApp: this.vuexStoreApp,
        vuexStoreAuth: this.vuexStoreAuth,
        vuexStoreEphemeral: this.vuexStoreEphemeral,
        vuexStoreObs: this.vuexStoreObs,
        interestingConstants: this.interestingConstants,
      }
    },
    emailBody() {
      return encodeURIComponent(JSON.stringify(this.contextObj, null, 2))
    },
    mailtoHref() {
      // system operator can give the user an email address out-of-band
      const bugReportEmail = 'replace-with-email'
      const subject = encodeURIComponent('WOW app bug report')
      // FIXME gMail complains with: it's too large (413)
      return `mailto:${bugReportEmail}&subject=${subject}&body=${this.emailBody}`
    },
    userAgent() {
      return (window.navigator || { userAgent: '(no window.navigator)' })
        .userAgent
    },
  },
  mounted() {
    gcpError.configure({
      projectId: 'wow-inspiring-australia-emg',
      key: constants.googleErrorsApiKey,
      serviceContext: {
        service: `wow-pwa.${constants.deployedEnvName}`,
        version: constants.appVersion,
      },
    })
  },
  methods: {
    async sendBugReport() {
      this.reportState = 'processing'
      try {
        await this.gatherContext()
        const msg =
          `[user=${this.myUsername}] User bug report. Comment='${this.bugComment}'.` +
          ` Context=${JSON.stringify(this.contextObj, null, 2)}`
        await gcpError.report({
          message: msg,
          user: this.myUsername,
        })
        this.reportState = 'success'
      } catch (err) {
        this.reportState = 'error'
        this.$store.dispatch(
          'flagGlobalError',
          {
            msg: `Failed to report bug`,
            err,
          },
          { root: true },
        )
      }
    },
    showTechDetails() {
      try {
        this.gatherContext()
        this.techDetailsLastUpdated = new Date().toISOString()
      } catch (err) {
        this.$store.dispatch(
          'flagGlobalError',
          {
            msg: `Failed to gather technical details`,
            err,
          },
          { root: true },
        )
      }
    },
    async gatherContext() {
      try {
        console.debug('Gathering bug report context')
        await this.gatherContextSw()
        await this.gatherContextAppStore()
        await this.gatherContextAuthStore()
        await this.gatherContextEphemeralStore()
        await this.gatherContextObsStore()
        await this.gatherContextConstants()
      } catch (err) {
        throw chainedError('Failed to gather context on bug report page', err)
      }
    },
    async gatherContextSw() {
      if (await isSwActive()) {
        const resp = await fetch(constants.serviceWorkerHealthCheckUrl)
        const respJson = await resp.json()
        const ahv = respJson.authHeaderValue
        this.swHealthCheckResult = {
          ...respJson,
          authHeaderValue: trimAndMeasure(ahv),
        }
      } else {
        this.swHealthCheckResult = '(no SW active)'
      }
    },
    gatherContextAppStore() {
      this.vuexStoreApp = this.$store.state.app
    },
    gatherContextAuthStore() {
      const authState = this.$store.state.auth
      this.vuexStoreAuth = {
        ...authState,
        token: trimAndMeasure(authState.token),
        apiToken: trimAndMeasure(authState.apiToken),
        code_challenge: trimAndMeasure(authState.code_challenge),
        code_verifier: trimAndMeasure(authState.code_verifier),
      }
    },
    gatherContextEphemeralStore() {
      const ephemeralState = this.$store.state.ephemeral
      this.vuexStoreEphemeral = [
        'deviceCoords',
        'hadSuccessfulDeviceLocReq',
        'photoCoords',
        'manualCoords',
      ].reduce(
        (accum, curr) => {
          accum[curr] = ephemeralState[curr]
          return accum
        },
        {
          queueProcessorPromise: ephemeralState.queueProcessorPromise
            ? '(truthy)'
            : '(falsy)',
        },
      )
    },
    gatherContextObsStore() {
      const obsState = this.$store.state.obs
      this.vuexStoreObs = {
        ...obsState,
        allRemoteObs: obsState.allRemoteObs.map(e => ({
          inatId: e.inatId,
          uuid: e.uuid,
        })),
        isDoingSync: this.$store.getters['obs/isDoingSync'],
        mySpecies: `(${obsState.mySpecies.length} items)`,
        projectInfo: `(is present?=${!!obsState.projectInfo})`,
        recentlyUsedTaxa: `(is present?=${!!obsState.recentlyUsedTaxa})`,
      }
    },
    gatherContextConstants() {
      this.interestingConstants = ['deployedEnvName', 'appVersion'].reduce(
        (accum, curr) => {
          accum[curr] = constants[curr]
          return accum
        },
        {},
      )
    },
  },
}

function trimAndMeasure(str) {
  if (!str) {
    return null
  }
  return str.substring(0, 5) + `...(string length=${str.length})`
}
</script>

<style lang="scss" scoped>
.success-alert,
.error-alert {
  padding: 1em;
  border-radius: 10px;
  margin: 0 auto;
}

.error-alert {
  border: 1px solid red;
  background: #ffdcdc;
}

.success-alert {
  border: 1px solid green;
  background: #d5ffbf;
}

.wow-textarea {
  padding: 12px 16px 14px;
  border-radius: 4px;
  width: 80%;
  height: 5em;
}
</style>
