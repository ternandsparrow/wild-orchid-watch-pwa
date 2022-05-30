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
          name="not-now-btn"
          class="wow-toast-btn red"
          @click="updateReadyToastVisible = false"
          >not now</v-ons-toolbar-button
        >
        <v-ons-toolbar-button
          name="update-now-btn"
          class="wow-toast-btn green"
          @click="onUpdate"
          >update</v-ons-toolbar-button
        >
      </div>
    </v-ons-toast>
    <v-ons-toast :visible.sync="notLoggedInToastVisible" animation="ascend">
      <div class="warn-text" @click="onHeaderClick">WARNING</div>
      <p>You are not logged in.</p>
      <p>
        If you were previously logged in then your session has expired. You
        <em>must</em> login to continue using the app.
      </p>
      <p>
        If you're in the middle of creating an observation, you can save it
        before logging in. Note that some functions may not work correctly until
        you login.
      </p>
      <button name="login-btn" @click="doLogin">Login</button>
    </v-ons-toast>
    <v-ons-alert-dialog
      modifier="rowfooter"
      :visible.sync="globalErrorDialogVisible"
    >
      <div slot="title">Something broke</div>
      <p v-if="globalErrorImgUrl">
        <img :src="globalErrorImgUrl" class="error-image-thumb" />
      </p>
      <p v-if="globalErrorUserMsg">{{ globalErrorUserMsg }}</p>
      <p>Sorry about that, try restarting the app or refreshing the webpage</p>
      <template slot="footer">
        <v-ons-alert-dialog-button
          name="dismiss-global-err-btn"
          @click="onDismissGlobalError"
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
      warningClickCount: 0,
      warningClickEasterEggTimeout: null,
      godModeForceLoginToastDismiss: false,
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
      'globalErrorImgUrl',
      'globalErrorUserMsg',
      'isForceShowLoginToast',
      'isGlobalErrorState',
      'refreshingApp',
      'showAddToHomeScreenModalForApple',
    ]),
    borderRadius() {
      return new URL(window.location).searchParams.get('borderradius') !== null
    },
    contentDownloadingToastVisible() {
      return !this.updateReadyToastVisible && this.refreshingApp
    },
    notLoggedInToastVisible() {
      if (this.godModeForceLoginToastDismiss) {
        return false
      }
      const isUserNotLoggedInAndSafeToShowToast =
        !this.isUserLoggedIn &&
        !this.isOnboarderVisible &&
        !this.isOauthCallbackVisible &&
        !this.isUpdatingApiToken
      return (
        !this.newContentAvailable &&
        (isUserNotLoggedInAndSafeToShowToast || this.isForceShowLoginToast)
      )
    },
  },
  watch: {
    newContentAvailable(val) {
      this.updateReadyToastVisible = val
    },
    isGlobalErrorState(val) {
      if (this.globalErrorDialogVisible) {
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
    onDismissGlobalError() {
      this.globalErrorDialogVisible = false
      this.$store.commit('ephemeral/resetGlobalErrorState')
    },
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
    async doLogin() {
      this.$store.commit('app/setIsFirstRun', false)
      await this.$store.dispatch('auth/doLogin')
    },
    onHeaderClick() {
      const tapCountThreshold = 7
      if (this.warningClickEasterEggTimeout) {
        clearTimeout(this.warningClickEasterEggTimeout)
      }
      this.warningClickEasterEggTimeout = setTimeout(() => {
        this.warningClickCount = 0
        this.warningClickEasterEggTimeout = null
      }, 1000)
      this.warningClickCount += 1
      if (this.warningClickCount < tapCountThreshold) {
        return
      }
      this.godModeForceLoginToastDismiss = true
      const twoMinutes = 2 * 60 * 1000
      setTimeout(() => {
        // nag again in the near future
        this.godModeForceLoginToastDismiss = false
      }, twoMinutes)
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

.error-image-thumb {
  max-width: 20vw;
  max-height: 30vh;
}
</style>
