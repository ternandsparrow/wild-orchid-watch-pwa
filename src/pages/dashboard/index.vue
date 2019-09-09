<template>
  <v-ons-page>
    <v-ons-list>
      <v-ons-list-header
        >This page will contain a Dashboard with the following elements..
      </v-ons-list-header>
      <ons-list-item>
        <label class="center">
          [TODO]: Gallery of recent (Australia-Wide) Observations
        </label>
      </ons-list-item>
      <ons-list-item>
        <label class="center">
          [TODO]: Gallery of (Local) Observations
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
    this.$store.commit('app/setTopTitle', 'Dashboard')
  },
}
</script>
