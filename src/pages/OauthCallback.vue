<template>
  <v-ons-page>
    <h1>callback</h1>
    <p>
      <router-link to="/">Home</router-link>
    </p>
    <div v-show="!isError" class="text-center">
      <v-ons-progress-circular indeterminate></v-ons-progress-circular>
      <div>Logging in...</div>
    </div>
    <div v-show="isError" class="error text-center">
      Something went wrong :(
    </div>
  </v-ons-page>
</template>

<script>
import { postJson, getJsonWithAuth } from '@/misc/helpers'
import { inatUrlBase, appId, redirectUri } from '@/misc/constants'

export default {
  name: 'OauthCallback',
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
      let token, tokenType, tokenCreatedAt
      const verifier = this.$store.state.auth.code_verifier
      try {
        const resp = await postJson(`${inatUrlBase}/oauth/token`, {
          client_id: appId,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: verifier,
        })
        console.debug(resp)
        token = resp.access_token
        tokenType = resp.token_type
        tokenCreatedAt = resp.created_at
        this.getApiToken(tokenType, token)
      } catch (err) {
        console.error('Failed to convert auth code to token', err)
        // FIXME report to rollbar
        this.isError = true
        return
      }
      this.$store.commit('auth/setToken', token)
      this.$store.commit('auth/setTokenType', tokenType)
      this.$store.commit('auth/setTokenCreatedAt', tokenCreatedAt)
      this.$router.push({ name: 'Admin' })
    },
    async getApiToken(tokenType, token) {
      try {
        const resp = await getJsonWithAuth(
          `${inatUrlBase}/users/api_token`,
          `${tokenType} ${token}`,
        )
        const apiToken = resp.api_token
        this.$store.commit('auth/setApiToken', apiToken)
      } catch (err) {
        console.error('Failed to get API token using iNat token', err)
        // FIXME report to rollbar
        this.isError = true
        return
      }
    },
  },
}
</script>

<style scoped>
.error {
  color: red;
}
</style>
