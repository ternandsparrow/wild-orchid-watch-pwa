<template>
  <v-ons-page>
    <custom-toolbar back-label="Home" title="Not Found"></custom-toolbar>
    <v-ons-card>
      <h1 class="text-center">Sorry, we couldn't find that page</h1>
      <p class="text-center">
        Requested URL: <a :href="failedUrl">{{ failedUrl }}</a>
      </p>
      <p>
        If you're looking for an observation, it may have been deleted or if you
        only recently created it, then it may have been successfully uploaded
        and now has a record ID assigned by iNaturalist. The best action is to
        go home and look for the record there.
      </p>
      <p class="text-center">
        <v-ons-button @click="goHome">Go home</v-ons-button>
      </p>
    </v-ons-card>
  </v-ons-page>
</template>

<script>
export default {
  name: 'NotFound',
  computed: {
    failedUrl() {
      return this.$route.query.failedUrl
    },
  },
  methods: {
    goHome() {
      this.$router.push({ name: 'Home' })
    },
  },
}
</script>
