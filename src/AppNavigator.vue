<template>
  <div>
    <v-ons-navigator
      swipeable
      swipe-target-width="50px"
      :page-stack="mainStack"
      :options="navOptions"
      :pop-page="storePop"
      :class="{ 'border-radius': borderRadius }"
    ></v-ons-navigator>
    <apple-add-to-home-screen-modal
      v-if="showAddToHomeScreenModalForApple"
      class="apple-add-to-home-screen-modal"
      @close="closeAddToHomeScreenModalForApple"
    >
    </apple-add-to-home-screen-modal>
    <v-ons-toast
      :visible.sync="contentDownloadingToastVisible"
      animation="ascend"
    >
      Downloading new app version...
    </v-ons-toast>
    <v-ons-toast :visible.sync="updateReadyToastVisible" animation="ascend">
      New version of the app ready.
      <div class="text-right">
        <v-ons-toolbar-button
          class="wow-toast-btn red"
          @click="updateReadyToastVisible = false"
          >not now</v-ons-toolbar-button
        >
        <v-ons-toolbar-button class="wow-toast-btn green" @click="onUpdate"
          >update</v-ons-toolbar-button
        >
      </div>
    </v-ons-toast>
    <v-ons-toast :visible.sync="notLoggedInToastVisible" animation="ascend">
      <div class="warn-text">WARNING</div>
      <p>
        You are not logged in, you <em>must</em> login to continue using the
        app.
      </p>
      <div>
        If you're in the middle of creating an observation, you can save it
        before logging in. Note that some functions may not work correctly until
        you login.
      </div>
      <button @click="doLogin">Login</button>
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
import {
  mainStack,
  isOnboarderVisible as isOnboarderVisibleFn,
  isOauthCallbackVisible as isOauthCallbackVisibleFn,
} from '@/misc/nav-stacks'

import AppleAddToHomeScreenModal from '@/components/AppleAddToHomeScreenModal'

export default {
  name: 'AppNavigator',
  components: { AppleAddToHomeScreenModal },
  data() {
    const result = {
      updateReadyToastVisible: false,
      globalErrorDialogVisible: false,
      mainStack,
      isOnboarderVisible: isOnboarderVisibleFn(),
      isOauthCallbackVisible: isOauthCallbackVisibleFn(),
    }
    result.navOptions = {
      callback: () => {
        // the downside of moving our nav stack management outside of vuex is
        // that we don't get magical value watching. Vue and Vuex watchers don't
        // seem to recalculate the result of our functions properly so we're
        // lucky we have a hook so we can do it ourselves
        result.isOnboarderVisible = isOnboarderVisibleFn()
        result.isOauthCallbackVisible = isOauthCallbackVisibleFn()
      },
    }
    return result
  },
  computed: {
    ...mapGetters('auth', ['isUserLoggedIn']),
    ...mapState('auth', ['isUpdatingApiToken']),
    ...mapGetters('ephemeral', ['newContentAvailable']),
    ...mapState('ephemeral', [
      'isForceShowLoginToast',
      'refreshingApp',
      'showAddToHomeScreenModalForApple',
    ]),
    ...mapState(['isGlobalErrorState']),
    borderRadius() {
      return new URL(window.location).searchParams.get('borderradius') !== null
    },
    contentDownloadingToastVisible() {
      return !this.updateReadyToastVisible && this.refreshingApp
    },
    notLoggedInToastVisible() {
      return (
        (!this.isUserLoggedIn &&
          !this.isOnboarderVisible &&
          !this.isOauthCallbackVisible &&
          !this.isUpdatingApiToken) ||
        this.isForceShowLoginToast
      )
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
      const isNavWithoutRoute = this.mainStack.length > 1
      if (isNavWithoutRoute) {
        this.mainStack.pop()
        return
      }
      const pathIndex = Math.max(0, this.$route.matched.length - 2)
      this.$router.push({
        name: this.$route.matched[pathIndex].name,
      })
    },
    doLogin() {
      this.$store.commit('app/setIsFirstRun', false)
      this.$store.dispatch('auth/doLogin')
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

.warn-text {
  color: #ffbf00;
  font-size: 1.5em;
}

.apple-add-to-home-screen-modal {
  position: absolute;
  bottom: 0;
  right: 0;
  top: 0;
  left: 0;
  height: fit-content;
  width: fit-content;
  margin: auto;
  z-index: 1000;
}
</style>
