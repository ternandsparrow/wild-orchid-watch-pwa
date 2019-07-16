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
import MyMissions from './MyMissions.vue'
import Available from './Available.vue'

export default {
  name: 'Missions',
  data() {
    return {
      tabs: [
        // FIXME change icons
        {
          label: 'My Missions',
          //icon: this.md ? null : 'md-collection-text',
          icon: this.fa ? null : 'fa-map-signs',
          page: MyMissions,
        },
        {
          label: 'Available',
          icon: this.md ? null : 'md-accounts-alt',
          page: Available,
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
        this.$store.commit('missions/setTab', newValue)
      },
    },
  },
  mounted() {
    this.$store.commit('app/setTopTitle', 'Missions')
  },
}
</script>
