<template>
  <v-ons-page>
    <v-ons-list>
      <v-ons-list-header
        >You can customise the WoW Field Data Collection App's settings
        here</v-ons-list-header
      >
      <ons-list-item>
        <label class="center" for="switch1">
          Sample Switch ({{ switchOn ? 'on' : 'off' }})
        </label>
        <div class="right">
          <v-ons-switch v-model="switchOn" input-id="switch1"> </v-ons-switch>
        </div>
      </ons-list-item>
      <ons-list-item>
        <label class="center" for="switch1">
          Show onboarder next time the App launches
        </label>
        <div class="right">
          <v-ons-button style=" 6px 0" @click="handleResetOnboarderClick()"
            >Reset</v-ons-button
          >
        </div>
      </ons-list-item>
    </v-ons-list>
  </v-ons-page>
</template>

<script>
export default {
  name: 'Settings',
  data() {
    return {
      switchOn: false,
    }
  },
  mounted() {
    this.$store.commit('app/setTopTitle', 'Settings')
  },
  methods: {
    handleResetOnboarderClick() {
      localStorage.removeItem('isNotFirstRun')
      this.$ons.notification.toast('Onboarder reset', {
        timeout: 1000,
        animation: 'ascend',
      })
    },
  },
}
</script>
