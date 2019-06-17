<template>
  <v-ons-toolbar :class="{ offline: !networkOnLine }">
    <div class="left">
      <slot name="left">
        <v-ons-back-button v-if="backLabel">
          {{ backLabel }}
        </v-ons-back-button>
      </slot>
    </div>
    <div class="center">
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
    title: {
      type: String,
    },
    backLabel: {
      type: String,
    },
  },
  computed: {
    ...mapState('app', ['networkOnLine']),
  },
}
</script>

<style scoped>
.offline {
  background-color: #fbd276;
}
</style>
