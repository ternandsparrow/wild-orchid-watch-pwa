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
import MyObs from './MyObs.vue'
// import Species from './Species'

export default {
  name: 'Observations',
  data() {
    return {
      tabs: [
        {
          label: 'Observations',
          icon: this.md ? null : 'fa-binoculars',
          page: MyObs,
        },
        // FIXME uncomment when we have the species detail pages done
        // {
        //   label: 'Species',
        //   icon: this.md ? null : 'fa-leaf',
        //   page: Species,
        // },
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
        return this.$store.state.obs.tabIndex
      },
      set(newValue) {
        this.$store.commit('obs/setTab', newValue)
      },
    },
  },
  mounted() {
    this.$store.commit('app/setTopTitle', 'My Observations')
  },
}
</script>
