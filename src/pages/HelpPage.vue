<template>
  <v-ons-page>
    <wow-help @close="goHome" />
  </v-ons-page>
</template>

<script>
export default {
  name: 'HelpPage',
  methods: {
    goHome() {
      this.$router.push({ name: 'Home' })
    },
  },
}
</script>

<style lang="scss" scoped></style>
