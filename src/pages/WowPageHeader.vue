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
              <v-ons-icon icon="md-menu"></v-ons-icon>
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

import MenuPage from '@/pages/Menu'
import { innerPageStack } from '@/misc/nav-stacks'

export default {
  name: 'WowPageHeader',
  components: { MenuPage },
  data() {
    return {
      innerPageStack,
    }
  },
  computed: {
    ...mapState('app', ['topTitle', 'isFirstRun']),
    isOpen: {
      get() {
        return this.$store.state.ephemeral.isSplitterOpen
      },
      set(newValue) {
        this.$store.commit('ephemeral/toggleSplitter', newValue)
      },
    },
  },
  mounted() {
    // Check for onboarding
    if (this.isFirstRun) {
      this.$router.replace({ name: 'Onboarder' })
    }
  },
  methods: {
    onMenuClick() {
      this.$store.commit('ephemeral/toggleSplitter')
    },
  },
}
</script>

<style scoped>
ons-splitter-side[animation='overlay'] {
  border-right: 1px solid #bbb;
}
</style>
