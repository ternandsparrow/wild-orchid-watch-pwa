<template>
  <v-ons-page>
    <v-ons-list>
      <v-ons-list-header>Test header</v-ons-list-header>
      <ons-list-item>
        <label class="center" for="switch1">
          Switch ({{ switchOn ? 'on' : 'off' }})
        </label>
        <div class="right">
          <v-ons-switch v-model="switchOn" input-id="switch1"> </v-ons-switch>
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
}
</script>
