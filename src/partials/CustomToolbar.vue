<template>
  <v-ons-toolbar :class="{ offline: !networkOnLine }">
    <div class="left">
      <slot name="left">
        <!-- FIXME can we simplify these cases? -->
        <v-ons-back-button v-if="backLabel && isHomeRoute">
          {{ backLabel }}
        </v-ons-back-button>
        <v-ons-toolbar-button
          v-if="!cancellable && !isHomeRoute"
          modifier="quiet"
          @click="goHome"
        >
          Home
        </v-ons-toolbar-button>
        <v-ons-toolbar-button
          v-if="cancellable && !isHomeRoute"
          modifier="quiet"
          @click="goBack"
        >
          Cancel
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
    cancellable: Boolean,
  },
  computed: {
    ...mapState('ephemeral', ['networkOnLine']),
    isHomeRoute() {
      return this.$route.path === '/'
    },
  },
  methods: {
    goHome() {
      this.$router.push('/')
    },
    goBack() {
      const msg = 'Are you sure you want to cancel?'
      this.$ons.notification.confirm(msg).then(isConfirmed => {
        if (!isConfirmed) {
          return
        }
        this.$store.commit('ephemeral/disableWarnOnLeaveRoute')
        this.$emit('cancelled')
        this.$router.go(-1)
      })
    },
  },
}
</script>

<style scoped>
.offline {
  background-color: #fbd276;
}
</style>
