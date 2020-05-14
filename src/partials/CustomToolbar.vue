<template>
  <v-ons-toolbar>
    <div class="left keep-title-centered">
      <slot name="left">
        <v-ons-back-button v-if="backLabel && isHomeRoute" name="back-btn">
          {{ backLabel }}
        </v-ons-back-button>
        <v-ons-toolbar-button
          v-if="!cancellable && !isHomeRoute"
          name="home-btn"
          modifier="quiet"
          @click="goHome"
        >
          Home
        </v-ons-toolbar-button>
        <v-ons-toolbar-button
          v-if="cancellable && !isHomeRoute"
          name="cancel-btn"
          modifier="quiet"
          @click="goBack"
        >
          Cancel
        </v-ons-toolbar-button>
      </slot>
    </div>
    <div class="center text-center wow-toolbar-title">
      <slot>{{ title }}</slot>
    </div>
    <div class="right keep-title-centered"><slot name="right"></slot></div>
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
      const msg = 'Are you sure you want to discard the changes you have made?'
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
.keep-title-centered {
  flex: 1 0 0;
}

.wow-toolbar-title {
  flex-grow: 0;
}
</style>
