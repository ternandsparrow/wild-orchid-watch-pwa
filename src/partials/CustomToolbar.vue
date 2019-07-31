<template>
  <v-ons-toolbar :class="{ offline: !networkOnLine }">
    <div class="left">
      <slot name="left">
        <v-ons-back-button v-if="backLabel && !isNotHomeRoute">
          {{ backLabel }}
        </v-ons-back-button>
        <v-ons-toolbar-button
          v-if="isNotHomeRoute"
          modifier="quiet"
          @click="goHome"
        >
          Home
        </v-ons-toolbar-button>
      </slot>
    </div>
    <!-- FIXME get the title always centered regardless of if the left/right is -->
    <!-- present or how wide they are                                           -->
    <div class="center text-center">
      <span v-if="!networkOnLine">[Offline] </span>
      <slot>{{ title }}</slot>
    </div>
    <div class="right"><slot name="right"></slot></div>
  </v-ons-toolbar>
</template>

<script>
import { mapState } from 'vuex'

export default {
  props: {
    title: String,
    backLabel: String,
  },
  computed: {
    ...mapState('ephemeral', ['networkOnLine']),
    isNotHomeRoute() {
      return this.$route.path !== '/'
    },
  },
  methods: {
    goHome() {
      this.$router.push('/')
    },
  },
}
</script>

<style scoped>
.offline {
  background-color: #fbd276;
}
</style>
