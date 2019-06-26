<template>
  <v-ons-page>
    <h1>callback</h1>
    <p>
      <router-link to="/">Home</router-link>
    </p>
    <p>code = {{ code }}</p>
    <p>{{ $route.query }}</p>
  </v-ons-page>
</template>

<script>
export default {
  name: 'OauthCallback',
  data() {
    return {
      code: null,
    }
  },
  mounted() {
    // would be nice if we could bind it to props like the docs say
    this.code = this.$route.query.code
    // FIXME handle code
    //  - get token from iNat
    //  - store token in vuex
  },
}
</script>
