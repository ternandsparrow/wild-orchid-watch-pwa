<template>
  <v-ons-page>
    <v-ons-tabbar
      position="auto"
      :modifier="isEnableAutogrow ? 'autogrow' : ''"
      swipeable
      :tabs="tabs"
      :index.sync="index"
    ></v-ons-tabbar>
  </v-ons-page>
</template>

<script>
import MyContent from './MyContent.vue'
import Following from './Following.vue'

export default {
  name: 'Activity',
  data() {
    return {
      tabs: [
        {
          label: 'My Content',
          icon: this.md ? null : 'md-collection-text',
          page: MyContent,
        },
        {
          label: 'Following',
          icon: this.md ? null : 'md-accounts-alt',
          page: Following,
        },
      ],
    }
  },
  computed: {
    isEnableAutogrow() {
      // FIXME stop onsen from exploding on page nav for android
      const forceDisable = false
      return forceDisable && this.md
    },
    index: {
      get() {
        return this.$store.state.activity.tabIndex
      },
      set(newValue) {
        this.$store.commit('activity/setTab', newValue)
      },
    },
  },
}
</script>
