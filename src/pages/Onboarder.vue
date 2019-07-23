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
      <v-ons-carousel-item :style="{ 'background-color': items.BLUE }">
        <v-ons-card class="wowOnboarderCard">
          <img
            src="@/assets/appicon-wow.png"
            alt="Wild Orchid Watch"
            class="wowLogoOnboarder"
          />
          <div class="title">
            Welcome!
          </div>
          <div class="content">
            Thanks for installing the Wild Orchid Watch Field Data collection
            App. We're excited to have your help with the project!
          </div>
        </v-ons-card>
      </v-ons-carousel-item>
      <v-ons-carousel-item :style="{ 'background-color': items.DARK }">
        <v-ons-card>
          <img
            src="@/assets/appicon-wow.png"
            alt="Wild Orchid Watch"
            class="wowLogoOnboarder"
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
      <v-ons-carousel-item :style="{ 'background-color': items.ORANGE }">
        <v-ons-card>
          <img
            src="@/assets/appicon-wow.png"
            alt="Wild Orchid Watch"
            class="wowLogoOnboarder"
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
      <v-ons-carousel-item :style="{ 'background-color': items.GREEN }">
        <v-ons-card class="center">
          <img
            src="@/assets/appicon-wow.png"
            alt="Wild Orchid Watch"
            class="wowLogoOnboarder"
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
            <ons-list-item
              class="notAccepted"
              :class="{ accepted: tsandcsAccepted }"
            >
              <div>
                <label class="center small-text">
                  I have read and accepted the WoW Field Data Collection App's
                  Terms and Conditions
                </label>
                <!-- 
                <a :href="subcategory.html" @click.prevent="showTAndCs($event)"
                  >Terms and Conditions
                </a>
                -->
                <label class="right">
                  <v-ons-checkbox
                    v-model="tsandcsAccepted"
                    :value="tsandcsAccepted"
                  />
                </label>
              </div>
            </ons-list-item>
            <ons-list-item>
              <div>
                <v-ons-button v-if="!tsandcsAccepted" @click="showTAndCs"
                  >View Terms and Conditions</v-ons-button
                >
                <v-ons-button v-if="tsandcsAccepted" @click="handleDoneClick"
                  >OK, let's go...!
                </v-ons-button>
              </div>
            </ons-list-item>
          </v-ons-list>
        </v-ons-card>
      </v-ons-carousel-item>
    </v-ons-carousel>
    <carousel-dots
      :dot-count="Object.keys(items).length"
      :selected-index="carouselIndex"
      :extra-styles="extraDotsStyle"
      @dot-click="onDotClick"
    ></carousel-dots>
    <v-ons-dialog cancelable :visible.sync="tsAndCsModalVisible">
      <div style="width:100%; height:70vh;">
        <!-- div class="dialogDiv" -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span v-html="tAndCHtml"></span>
      </div>
    </v-ons-dialog>

    <!-- v-ons-dialog cancelable :visible.sync="tsAndCsModalVisible">
      <v-ons-page>
        <v-ons-toolbar>sdfjhsd jhgdsffsghd</v-ons-toolbar>
        this si sowdflnsdlf sd kjfhsdfjds sdfjhsdsd fdfsfsdf sdfsdfsfdsdfsdf<br />
        sdfsdfsfdsdfsdf dfgdggffffff ggggg
      </v-ons-page>
    </v-ons-dialog-->
  </v-ons-page>
</template>

<script>
// FIXME can't use this local import method until we get a fix for
// https://github.com/OnsenUI/OnsenUI/issues/2662. Using global
// components in main.js in the interim.
// import CarouselDots from '@/partials/CarouselDots'

export default {
  data() {
    return {
      carouselIndex: 0,
      items: {
        BLUE: '#085078',
        DARK: '#373B44',
        ORANGE: '#D38312',
        GREEN: 'green',
      },
      extraDotsStyle: {
        position: 'absolute',
        bottom: '40px',
        left: 0,
        right: 0,
      },
      tsandcsAccepted: false,
      tsAndCsModalVisible: false,
      tAndCHtml: require('@/assets/wow-t-and-c.html'),
    }
  },
  // components: { CarouselDots },
  methods: {
    handleDoneClick() {
      localStorage.setItem('isNotFirstRun', true)
      localStorage.setItem('tsandcsAccepted', true)
      this.$store.commit('navigator/pop')
    },
    onDotClick(carouselIndex) {
      this.carouselIndex = carouselIndex
    },
    showTAndCs() {
      this.tsAndCsModalVisible = true
    },
  },
}
</script>

<style scoped>
ons-carousel-item {
  display: table;
  text-align: center;
}

.wowLogoOnboarder {
  display: block;
  margin-left: auto;
  margin-right: auto;
  width: 90%;
}

.wowOnboarderCard {
  height: '90%';
}

.notAccepted {
  margin-top: 10px;
  border-radius: 25px;
  background-color: rgb(255, 16, 16);
}
.accepted {
  margin-top: 10px;
  border-radius: 25px;
  background-color: rgb(0, 187, 0);
}

.invisible {
  visibility: hidden;
}

.dialogDiv {
  min-height: 300px;
}
</style>
