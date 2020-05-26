<template>
  <v-ons-page>
    <h1 class="text-center">Logging in...</h1>
    <div v-show="!isError" class="text-center">
      <v-ons-progress-circular indeterminate></v-ons-progress-circular>
      <div>This won't take long</div>
    </div>
    <div v-show="isError" class="text-center">
      <p class="error">Whoops, that didn't work.</p>
      <p>It's worth trying a second time as it often works (seriously!).</p>
      <p>
        <router-link to="/" class="home-link">Home</router-link>
        <v-ons-button @click="handleLoginClick">Retry login </v-ons-button>
      </p>
    </div>
  </v-ons-page>
</template>

<script>
import { postJson, wowErrorHandler } from '@/misc/helpers'
import {
  inatUrlBase,
  appId,
  redirectUri,
  oauthCallbackComponentName,
} from '@/misc/constants'

export default {
  name: oauthCallbackComponentName,
  data() {
    return {
      isError: false,
    }
  },
  mounted() {
    const code = this.$route.query.code
    this.processCode(code)
  },
  methods: {
    async processCode(code) {
      this.isError = false
      let token, tokenType, tokenCreatedAt
      const verifier = this.$store.state.auth.code_verifier
      try {
        if (!verifier) {
          throw new Error(
            `OAuth code_verifier='${verifier}' is not set, cannot continue.`,
          )
        }
        const resp = await postJson(`${inatUrlBase}/oauth/token`, {
          client_id: appId,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: verifier,
        })
        console.debug('OAuth code to token resp:', resp)
        token = resp.access_token
        tokenType = resp.token_type
        tokenCreatedAt = resp.created_at
      } catch (err) {
        wowErrorHandler('Failed to convert auth code to token', err)
        this.isError = true
        return
      }
      this.$store.dispatch('auth/saveToken', {
        token,
        tokenType,
        tokenCreatedAt,
      })
      this.$store.commit('auth/setIsUpdatingApiToken', true)
      this.$router.replace({ name: 'Home' })
    },
    handleLoginClick() {
      this.$wow.uiTrace('OauthCallback', 'retry-login')
      this.$store.commit('app/setIsFirstRun', false)
      this.$store.dispatch('auth/doLogin')
    },
  },
}
</script>

<style scoped>
.error {
  color: red;
}

.home-link {
  margin-right: 1em;
}
</style>
