<template>
  <v-ons-page>
    <h1>callback</h1>
    <p>
      <router-link to="/">Home</router-link>
    </p>
    <div class="text-center">
      <v-ons-progress-circular indeterminate></v-ons-progress-circular>
      <div>Logging in...</div>
    </div>
  </v-ons-page>
</template>

<script>
export default {
  name: 'OauthCallback',
  mounted() {
    const matches = this.$route.hash.match(
      /#access_token=([0-9a-f]*)&token_type=(\w*)/,
    ) // TODO too brittle?
    const token = matches[1]
    const tokenType = matches[2]
    this.$store.commit('auth/setToken', token)
    this.$store.commit('auth/setTokenType', tokenType)
    this.processToken()
  },
  methods: {
    async processToken() {
      // FIXME also get JWT for API
      // FIXME bounce user to home
    },
  },
}
</script>
