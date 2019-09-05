<template>
  <v-ons-page>
    <v-ons-list>
      <v-ons-list-header
        >This page will contain information on the science which is enabled by
        the collected Observations..
      </v-ons-list-header>
      <ons-list-item>
        <label class="center">
          [TODO]: Science paragraph 1
        </label>
      </ons-list-item>
      <ons-list-item>
        <label class="center">
          [TODO]: Science paragraph 2
        </label>
      </ons-list-item>
    </v-ons-list>
  </v-ons-page>
</template>

<script>
export default {
  name: 'Dashboard',
  data() {
    return {}
  },
  mounted() {
    this.$store.commit('app/setTopTitle', 'Orchid Science')
  },
}
</script>
