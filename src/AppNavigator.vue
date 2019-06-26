<template>
  <div>
    <v-ons-navigator
      swipeable
      swipe-target-width="50px"
      :page-stack="pageStack"
      :pop-page="storePop"
      :options="options"
      :class="{ 'border-radius': borderRadius }"
    ></v-ons-navigator>
    <!-- FIXME get apple "add to home" working                         -->
    <!-- https://onsen.io/v2/guide/pwa/tutorial.html#add-to-homescreen -->
    <!-- <apple-add-to-home-screen-modal                               -->
    <!--   v-if="showAddToHomeScreenModalForApple"                     -->
    <!--   class="apple-add-to-home-screen-modal"                      -->
    <!--   @close="closeAddToHomeScreenModalForApple(false)"           -->
    <!-- >                                                             -->
    <!-- </apple-add-to-home-screen-modal>                             -->
    <v-ons-toast
      :visible.sync="contentDownloadingToastVisible"
      animation="ascend"
    >
      Downloading new content...
    </v-ons-toast>
    <v-ons-toast :visible.sync="updateReadyToastVisible" animation="ascend">
      New content available.
      <button @click="onUpdate">update</button>
    </v-ons-toast>
  </div>
</template>

<script>
import { mapState, mapActions, mapGetters } from 'vuex'

// import AppleAddToHomeScreenModal from '@/components/AppleAddToHomeScreenModal'

export default {
  name: 'AppNavigator',
  // components: { AppleAddToHomeScreenModal },
  data() {
    return {
      isNotFirstRun: false,
      updateReadyToastVisible: false,
    }
  },
  computed: {
    ...mapGetters('app', ['newContentAvailable']),
    ...mapState('app', ['showAddToHomeScreenModalForApple', 'refreshingApp']),
    ...mapGetters('navigator', ['pageStack']),
    options() {
      return this.$store.state.navigator.options
    },
    borderRadius() {
      return new URL(window.location).searchParams.get('borderradius') !== null
    },
    contentDownloadingToastVisible() {
      return !this.updateReadyToastVisible && this.refreshingApp
    },
  },
  watch: {
    newContentAvailable(val) {
      this.updateReadyToastVisible = val
    },
  },
  methods: {
    ...mapActions('app', [
      'closeAddToHomeScreenModalForApple',
      'serviceWorkerSkipWaiting',
    ]),
    onUpdate() {
      this.serviceWorkerSkipWaiting()
      this.updateReadyToastVisible = false
    },
    storePop() {
      this.$router.push({
        name: this.$route.matched[this.$route.matched.length - 2].name,
      })
    },
  },
}
</script>
