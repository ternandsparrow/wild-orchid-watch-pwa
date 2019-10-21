<template>
  <v-ons-page>
    <v-ons-carousel
      id="carousel"
      fullscreen
      swipeable
      auto-scroll
      auto-scroll-ratio="0.2"
      overscrollable
      :index.sync="carouselIndex"
    >
      <v-ons-carousel-item>
        <v-ons-card class="wow-card">
          <img
            src="@/assets/onboarder/wow-splash.png"
            alt="Wild Orchid Watch"
            class="wow-onboarder-logo"
          />
          <p class="version-number text-center">Version: {{ appVersion }}</p>
          <div class="title text-center mt-1">
            Welcome!
          </div>
          <div class="content">
            Thanks for installing the Wild Orchid Watch Field Data collection
            App. We're excited to have your help with the project!
          </div>
        </v-ons-card>
        <div class="swipe-msg">swipe to next page</div>
        <i class="swipe-dot"></i>
      </v-ons-carousel-item>
      <v-ons-carousel-item>
        <v-ons-card class="wow-card">
          <img
            src="@/assets/onboarder/greenhood_app.jpg"
            alt="Using the App"
            class="wow-onboarder-logo"
          />
          <div class="title">
            Data Collection
          </div>
          <div class="content">
            The App allows you to collect and automatically submit native orchid
            sightings. You can let the App know if you prefer to use either WiFi
            or the cellular network when uploading sightings to the server.
          </div>
        </v-ons-card>
      </v-ons-carousel-item>
      <v-ons-carousel-item>
        <v-ons-card class="wow-card">
          <img
            src="@/assets/onboarder/shell_orchid.jpg"
            alt="Watch for trampling"
            class="wow-onboarder-logo"
          />
          <div class="title">
            Safety
          </div>
          <div class="content">
            Always make sure you tread carefully, for your safety and also for
            the native orchids. They can easily be trampled by accident!
          </div>
        </v-ons-card>
      </v-ons-carousel-item>
      <v-ons-carousel-item>
        <v-ons-card class="wow-card">
          <img
            src="@/assets/onboarder/scaling_card.jpg"
            alt="Scaling Card"
            class="wow-onboarder-logo"
          />
          <div class="title">
            Scientific use
          </div>
          <div class="content">
            The Observations you collect will be directly used by Scientists
            researching how native Australian orchids can act as indicators of
            ecosystem and biodiversity change.
          </div>
          <v-ons-list>
            <v-ons-list-item tappable>
              <label class="left">
                <v-ons-checkbox v-model="tsAndCsAccepted" input-id="accepted">
                </v-ons-checkbox>
              </label>
              <label class="center" for="accepted">
                I have read and accepted the WoW Field Data Collection App's
                Terms and Conditions; and I acknowledge that I will only use the
                app in locations where I have permission to do so.
              </label>
            </v-ons-list-item>
            <ons-list-item>
              <div>
                <!-- FIXME tell user they'll be logging in with iNat? -->
                <v-ons-button v-if="!tsAndCsAccepted" @click="showTAndCs"
                  >View Terms and Conditions</v-ons-button
                >
                <v-ons-button v-if="tsAndCsAccepted" @click="handleDoneClick"
                  >OK, let's go...!
                </v-ons-button>
              </div>
            </ons-list-item>
          </v-ons-list>
        </v-ons-card>
      </v-ons-carousel-item>
    </v-ons-carousel>
    <carousel-dots
      :dot-count="cardCount"
      :selected-index="carouselIndex"
      :extra-styles="extraDotsStyle"
      @dot-click="onDotClick"
    ></carousel-dots>
    <v-ons-dialog cancelable :visible.sync="tsAndCsModalVisible">
      <div style="width:90vw; height:90vh;">
        <iframe
          src="/wow-t-and-c-v3.html"
          frameborder="0"
          class="wow-t-c-iframe"
        ></iframe>
        <div class="close-btn" @click="onTAndCsCloseClick">Close</div>
      </div>
    </v-ons-dialog>
  </v-ons-page>
</template>

<script>
import { onboarderComponentName, appVersion } from '@/misc/constants'
// FIXME can't use this local import method until we get a fix for
// https://github.com/OnsenUI/OnsenUI/issues/2662. Using global
// components in main.js in the interim.
// import CarouselDots from '@/partials/CarouselDots'

export default {
  name: onboarderComponentName,
  data() {
    return {
      appVersion,
      carouselIndex: 0,
      cardCount: 4, // needs to match how many cards we have, TODO make dynamic
      extraDotsStyle: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        color: '#333',
      },
      tsAndCsModalVisible: false,
    }
  },
  computed: {
    tsAndCsAccepted: {
      get() {
        return this.$store.state.app.tsAndCsAccepted
      },
      set(newVal) {
        this.$store.commit('app/setTsAndCsAccepted', newVal)
      },
    },
  },
  mounted() {
    const shouldUserSeeOnboarder = this.$store.state.app.isFirstRun
    if (shouldUserSeeOnboarder) {
      return
    }
    this.$router.replace({ name: 'Home' })
  },
  // components: { CarouselDots },
  methods: {
    handleDoneClick() {
      this.$store.commit('app/setIsFirstRun', false)
      this.$store.dispatch('auth/doLogin')
    },
    onDotClick(carouselIndex) {
      this.carouselIndex = carouselIndex
    },
    showTAndCs() {
      this.tsAndCsModalVisible = true
    },
    onTAndCsCloseClick() {
      this.tsAndCsModalVisible = false
    },
  },
}
</script>

<style scoped>
.wow-onboarder-logo {
  display: block;
  margin-left: auto;
  margin-right: auto;
  max-width: 90%;
}

.wow-card {
  overflow-y: auto;
  max-height: 80vh;
}

.swipe-msg {
  font-size: 1.5em;
  color: grey;
  text-align: center;
  margin-bottom: 1em;
}

.swipe-dot {
  background: grey;
  height: 20px;
  width: 20px;
  border-radius: 50%;
  animation: swipe 2s ease-in-out infinite;
  opacity: 0.5;
  display: block;
  margin: 0 auto;
  transform-origin: bottom;
  box-shadow: 0px 0px 15px;
}

@keyframes swipe {
  0% {
    transform: translate(200%);
  }
  100% {
    transform: translate(-200%);
  }
}

.content {
  color: #444;
}

.wow-t-c-iframe {
  overflow: hidden;
  height: 95%;
  width: 100%;
}

.close-btn {
  text-align: center;
  font-weight: bold;
  color: #333;
}

.version-number {
  color: #747474;
  font-size: 0.8em;
  margin: 0;
}
</style>
