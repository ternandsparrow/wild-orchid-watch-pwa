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
import Species from './Species.vue'

export default {
  name: 'Observations',
  data() {
    return {
      tabs: [
        {
          label: 'Observations',
          icon: this.md ? null : 'ion-home',
          page: MyObs,
        },
        {
          label: 'Species',
          icon: this.md ? null : 'ion-leaf',
          page: Species,
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
        return this.$store.state.obs.tabIndex
      },
      set(newValue) {
        this.$store.commit('obs/setTab', newValue)
      },
    },
  },
  mounted() {
    this.$store.commit('app/setTopTitle', 'My observations')
  },
}
</script>
