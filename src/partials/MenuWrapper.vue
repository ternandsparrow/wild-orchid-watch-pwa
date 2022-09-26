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
            {{ title }}
            <v-ons-toolbar-button
              slot="left"
              name="app-menu-btn"
              @click="onMenuClick"
            >
              <v-ons-icon icon="md-menu"></v-ons-icon>
            </v-ons-toolbar-button>
            <slot slot="right" name="toolbar-right"></slot>
          </custom-toolbar>
          <slot></slot>
        </v-ons-page>
      </v-ons-splitter-content>
    </v-ons-splitter>
  </v-ons-page>
</template>

<script>
import MenuPage from '@/pages/Menu'

export default {
  name: 'MenuWrapper',
  components: { MenuPage },
  props: {
    title: {
      type: String,
      required: true,
    },
  },
  computed: {
    // TODO we've seen uncaught promise rejections on Apple devices for
    // "Another splitter-side action is already running.". To trap them, we need
    // to somehow .catch() on the promise returned from the toggle() call on the
    // splitter. With the current set up, not sure how to do that.
    isOpen: {
      get() {
        return this.$store.state.ephemeral.isSplitterOpen
      },
      set(newValue) {
        this.$store.commit('ephemeral/toggleSplitter', newValue)
      },
    },
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
