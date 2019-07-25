<template>
  <v-ons-page>
    <h1>Logging in...</h1>
    <div v-show="!isError" class="text-center">
      <v-ons-progress-circular indeterminate></v-ons-progress-circular>
      <div>This won't take long</div>
    </div>
    <div v-show="isError" class="error text-center">
      Something went wrong :(
      <p>
        <router-link to="/">Home</router-link>
      </p>
    </div>
  </v-ons-page>
</template>

<script>
import { postJson, wowErrorHandler } from '@/misc/helpers'
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
      this.$router.push({ name: 'Home' })
    },
  },
}
</script>

<style scoped>
.error {
  color: red;
}
</style>
