<template>
  <v-ons-page>
    <v-ons-splitter>
      <v-ons-splitter-side
        swipeable
        side="left"
        collapse=""
        width="260px"
        :swipe-target-width="md && 25"
        :animation="md ? 'overlay' : 'reveal'"
        :open.sync="isOpen"
      >
        <menu-page></menu-page>
      </v-ons-splitter-side>

      <v-ons-splitter-content>
        <v-ons-page>
          <custom-toolbar>
            {{ topTitle }}
            <v-ons-toolbar-button slot="left" @click="onMenuClick">
              <v-ons-icon icon="ion-navicon, material:md-menu"></v-ons-icon>
            </v-ons-toolbar-button>
          </custom-toolbar>
          <v-ons-navigator :page-stack="innerPageStack"></v-ons-navigator>
        </v-ons-page>
      </v-ons-splitter-content>
    </v-ons-splitter>
  </v-ons-page>
</template>

<script>
import { mapState } from 'vuex'

import Onboarder from '@/pages/Onboarder'
import MenuPage from '@/pages/Menu'

// FIXME add separate routes for all child pages

export default {
  name: 'WowHeader',
  components: { MenuPage },
  computed: {
    ...mapState('app', ['topTitle', 'innerPageStack']),
    isOpen: {
      get() {
        return this.$store.state.splitter.open
      },
      set(newValue) {
        this.$store.commit('splitter/toggle', newValue)
      },
    },
  },
  beforeCreate() {
    // Check for onboarding
    const localStorageTargetKey = 'isNotFirstRun'
    this.isNotFirstRun = localStorage.getItem(localStorageTargetKey)
    if (this.isNotFirstRun === null) {
      this.$store.commit('navigator/push', Onboarder)
    }
  },
  methods: {
    onMenuClick() {
      this.$store.commit('splitter/toggle')
    },
  },
}
</script>

<style scoped>
ons-splitter-side[animation='overlay'] {
  border-right: 1px solid #bbb;
}
</style>
