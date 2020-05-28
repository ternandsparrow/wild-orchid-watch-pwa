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
        <label>Any extra comments</label>
      </p>
      <p>
        <textarea v-model="bugComment"></textarea>
      </p>
      <p>
        <!-- FIXME make this nicer -->
        Status=<span>{{ reportState }}</span>
      </p>
      <p>
        <v-ons-button @click="sendBugReport">Send report</v-ons-button>
      </p>
    </v-ons-card>
    <v-ons-card>
      <div v-if="isShowTechDetails">
        <div><a :href="mailtoHref" target="_blank">Send via email</a></div>
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
      <p>
        <v-ons-button modifier="quiet" @click="showTechDetails"
          >Display technical details</v-ons-button
        >
      </p>
    </v-ons-card>
  </menu-wrapper>
</template>

<script>
import { mapGetters } from 'vuex'
import * as gcpError from 'stackdriver-error-reporting-clientside-js-client'
import * as constants from '@/misc/constants'
import { isSwActive } from '@/misc/helpers'

export default {
  name: 'BugReport',
  data() {
    return {
      bugComment: null,
      reportState: 'initial',
      reportFailureError: null,
      isShowTechDetails: false,
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
          `User bug report. Comment='${this.bugComment}'.` +
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
      this.gatherContext()
      this.isShowTechDetails = true
    },
    async gatherContext() {
      console.debug('Gathering bug report context')
      try {
        await this.gatherContextSw()
        await this.gatherContextAppStore()
        await this.gatherContextAuthStore()
        await this.gatherContextEphemeralStore()
        await this.gatherContextObsStore()
        await this.gatherContextConstants()
      } catch (err) {
        this.$store.dispatch(
          'flagGlobalError',
          {
            msg: `Failed to gather context for bug report page`,
            err,
          },
          { root: true },
        )
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
      ].reduce((accum, curr) => {
        accum[curr] = ephemeralState[curr]
        return accum
      }, {})
    },
    gatherContextObsStore() {
      const obsState = this.$store.state.obs
      this.vuexStoreObs = {
        ...obsState,
        allRemoteObs: obsState.allRemoteObs.map(e => ({
          inatId: e.inatId,
          uuid: e.uuid,
        })),
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
  return str.substring(0, 5) + `...(string length=${str.length})`
}
</script>
