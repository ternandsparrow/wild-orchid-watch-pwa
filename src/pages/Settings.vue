<template>
  <v-ons-page>
    <v-ons-list>
      <v-ons-list-header
        >You can customise the WoW Field Data Collection App's settings
        here</v-ons-list-header
      >
      <ons-list-item>
        <label class="center" for="switch1">
          Logout from Wild Orchid Watch and iNaturalist
        </label>
        <div class="right">
          <v-ons-button @click="doLogout">Logout</v-ons-button>
        </div>
      </ons-list-item>
      <ons-list-item>
        <label class="center" for="switch1">
          Show onboarder next time the App launches
        </label>
        <div class="right">
          <v-ons-button @click="handleResetOnboarderClick">Reset</v-ons-button>
        </div>
      </ons-list-item>
    </v-ons-list>
  </v-ons-page>
</template>

<script>
export default {
  name: 'Settings',
  mounted() {
    this.$store.commit('app/setTopTitle', 'Settings')
  },
  methods: {
    handleResetOnboarderClick() {
      this.$store.commit('app/setIsFirstRun', true)
      this.$ons.notification.toast('Onboarder reset', {
        timeout: 1000,
        animation: 'ascend',
      })
    },
    doLogout() {
      // FIXME implment me
      alert('FIXME implement this')
    },
  },
}
</script>
