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
        <v-ons-card>
          <img
            src="@/assets/appicon-wow.png"
            alt="Wild Orchid Watch"
            style="width: 100%"
          />
          <div class="title">
            Welcome!
          </div>
          <div class="content">
            Thanks for installing the Wild Orchid Watch Field Data collection
            app. We're excited to have you on-board!
          </div>
        </v-ons-card>
      </v-ons-carousel-item>
      <v-ons-carousel-item :style="{ 'background-color': items.DARK }">
        <v-ons-card>
          <img
            src="@/assets/appicon-wow.png"
            alt="Wild Orchid Watch"
            style="width: 100%"
          />
          <div class="title">
            Data Collection
          </div>
          <div class="content">
            This is super-cool
          </div>
        </v-ons-card>
      </v-ons-carousel-item>
      <v-ons-carousel-item :style="{ 'background-color': items.ORANGE }">
        <v-ons-card>
          <img
            src="@/assets/appicon-wow.png"
            alt="Wild Orchid Watch"
            style="width: 100%"
          />
          <div class="title">
            Scientific use
          </div>
          <div class="content">
            This is even cooler
          </div>
        </v-ons-card>
        <div class="button_holder">
          <v-ons-button @click="handleDoneClick"
            >OK, let's collect some data</v-ons-button
          >
        </div>
      </v-ons-carousel-item>
    </v-ons-carousel>
    <carousel-dots
      :dot-count="Object.keys(items).length"
      :selected-index="carouselIndex"
      :extra-styles="extraDotsStyle"
      @dot-click="onDotClick"
    ></carousel-dots>
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
      },
      extraDotsStyle: {
        position: 'absolute',
        bottom: '40px',
        left: 0,
        right: 0,
      },
    }
  },
  // components: { CarouselDots },
  methods: {
    handleDoneClick() {
      this.$store.commit('navigator/pop')
    },
    onDotClick(carouselIndex) {
      this.carouselIndex = carouselIndex
    },
  },
}
</script>

<style scoped>
ons-carousel-item {
  display: table;
  text-align: center;
}
</style>
