<template>
  <v-ons-toolbar :class="{ offline: !networkOnLine }">
    <div class="left keep-title-centered">
      <slot name="left">
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
    <div class="center text-center wow-toolbar-title">
      <span v-if="!networkOnLine">[Offline] </span>
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

.keep-title-centered {
  flex: 1 0 0;
}

.wow-toolbar-title {
  flex-grow: 0;
}
</style>
