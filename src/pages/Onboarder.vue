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
            src="@/assets/onboarder/wow-splash.jpg"
            alt="Wild Orchid Watch"
            class="wow-onboarder-logo"
          />
          <p class="version-number text-center">Version: {{ appVersion }}</p>
          <div class="title text-center mt-1">Welcome!</div>
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
          <div class="title">Data Collection</div>
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
          <div class="title">Safety</div>
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
          <div class="title">Scientific use</div>
          <div class="content">
            The Observations you collect will be directly used by Scientists
            researching how native Australian orchids can act as indicators of
            ecosystem and biodiversity change.
          </div>
        </v-ons-card>
      </v-ons-carousel-item>
      <v-ons-carousel-item>
        <v-ons-card class="wow-card">
          <p class="spaced-lines">
            By using The WOW app in partnership with iNaturalist you agree to
            the
            <a href="https://www.inaturalist.org/pages/terms" target="_blank"
              >iNaturalist Terms of Service</a
            >
            and
            <a href="http://www.inaturalist.org/pages/privacy" target="_blank"
              >Privacy Policy</a
            >.
          </p>
          <p>
            You also agree to join the
            <a :href="projectHref" target="_blank">WOW iNaturalist project</a>
            and grant access to the accurate observation coordinates
            <em>only</em> to the trusted managers of the project.
          </p>
          <p class="spaced-lines">
            For more information please see
            <a href="www.wildorchidwatch.org/wowapp" target="_blank"
              >WOW FAQs page</a
            >.
          </p>
          <div>
            <v-ons-button @click="handleLoginClick"
              >Login with iNaturalist
            </v-ons-button>
          </div>
        </v-ons-card>
      </v-ons-carousel-item>
    </v-ons-carousel>
    <carousel-dots
      :dot-count="cardCount"
      :selected-index="carouselIndex"
      :extra-styles="extraDotsStyle"
      @dot-click="onDotClick"
    ></carousel-dots>
  </v-ons-page>
</template>

<script>
import {
  onboarderComponentName,
  appVersion,
  inatUrlBase,
  inatProjectSlug,
} from '@/misc/constants'

export default {
  name: onboarderComponentName,
  data() {
    return {
      appVersion,
      carouselIndex: 0,
      cardCount: 5, // needs to match how many cards we have, TODO make dynamic
      extraDotsStyle: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        color: '#333',
        'z-index': 1, // WOW-60 needed for Firefox
      },
    }
  },
  computed: {
    isIos() {
      return navigator.userAgent.match(/(iPod|iPhone|iPad)/)
    },
    projectHref() {
      return `${inatUrlBase}/projects/${inatProjectSlug}`
    },
  },
  mounted() {
    const shouldUserSeeOnboarder = this.$store.state.app.isFirstRun
    if (shouldUserSeeOnboarder) {
      return
    }
    this.$router.replace({ name: 'Home' })
  },
  methods: {
    handleLoginClick() {
      this.$wow.uiTrace('Onboarder', 'login')
      this.$store.commit('app/setIsFirstRun', false)
      this.$store.dispatch('auth/doLogin')
    },
    onDotClick(carouselIndex) {
      this.carouselIndex = carouselIndex
    },
  },
}
</script>

<style lang="scss" scoped>
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

.wow-t-c-container {
  width: 90vw;
  height: 80vh;
  display: flex;
  flex-direction: column;

  .iframe-wrapper {
    /* thanks https://stackoverflow.com/a/33272824/1410035 */
    flex-grow: 1;
    display: flex;
    flex-direction: column;

    iframe {
      width: 100%;
      flex-grow: 1;
    }
  }
}

.make-safari-scroll {
  /* thanks https://davidwalsh.name/scroll-iframes-ios */
  -webkit-overflow-scrolling: touch;
  overflow-y: scroll;
}

.close-btn {
  text-align: center;
  font-weight: bold;
  color: #333;
  line-height: 2em;
}

.version-number {
  color: #747474;
  font-size: 0.8em;
  margin: 0;
}

.spaced-lines {
  line-height: 1.5em;
}
</style>
