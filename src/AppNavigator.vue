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
      Downloading new app version...
    </v-ons-toast>
    <v-ons-toast :visible.sync="updateReadyToastVisible" animation="ascend">
      New version of the app ready.
      <v-ons-toolbar-button
        class="wow-toast-btn red"
        @click="updateReadyToastVisible = false"
        >not now</v-ons-toolbar-button
      >
      <v-ons-toolbar-button class="wow-toast-btn green" @click="onUpdate"
        >update</v-ons-toolbar-button
      >
    </v-ons-toast>
    <v-ons-alert-dialog
      modifier="rowfooter"
      :visible.sync="globalErrorDialogVisible"
    >
      <span slot="title">Something broke</span>
      Sorry about that, try restarting the app or refreshing the webpage
      <template slot="footer">
        <v-ons-alert-dialog-button @click="globalErrorDialogVisible = false"
          >Ok</v-ons-alert-dialog-button
        >
      </template>
    </v-ons-alert-dialog>
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
      updateReadyToastVisible: false,
      globalErrorDialogVisible: false,
    }
  },
  computed: {
    ...mapGetters('ephemeral', ['newContentAvailable']),
    ...mapState('ephemeral', [
      'showAddToHomeScreenModalForApple',
      'refreshingApp',
    ]),
    ...mapState(['isGlobalErrorState']),
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
    isGlobalErrorState(val) {
      if (!val || this.globalErrorDialogVisible) {
        return
      }
      this.globalErrorDialogVisible = val
    },
  },
  methods: {
    ...mapActions('ephemeral', [
      'closeAddToHomeScreenModalForApple',
      'serviceWorkerSkipWaiting',
    ]),
    onUpdate() {
      this.serviceWorkerSkipWaiting()
      this.updateReadyToastVisible = false
    },
    storePop() {
      // FIXME we don't need this pageStack check when all parts of the app have a unique route
      const isNavWithoutRoute = this.pageStack.length > 1
      if (isNavWithoutRoute) {
        this.$store.commit('navigator/pop')
        return
      }
      const pathIndex = Math.max(0, this.$route.matched.length - 2)
      this.$router.push({
        name: this.$route.matched[pathIndex].name,
      })
    },
  },
}
</script>

<style scoped>
.wow-toast-btn {
  font-size: 1.3em;
}

.wow-toast-btn.red {
  color: #ff4c4c;
}

.wow-toast-btn.green {
  color: #04ff00;
}
</style>
