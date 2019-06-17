<template>
  <v-ons-page>
    <v-ons-carousel
      id="carousel"
      fullscreen
      swipeable
      auto-scroll
      overscrollable
      :index.sync="carouselIndex"
    >
      <v-ons-carousel-item style="background-color: #085078;">
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
      <v-ons-carousel-item style="background-color: #373B44;">
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
      <v-ons-carousel-item style="background-color: #D38312;">
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
          <v-ons-button @click="handleClick"
            >OK, let's collect some data</v-ons-button
          >
        </div>
      </v-ons-carousel-item>
    </v-ons-carousel>
    <div :style="dots">
      <span
        v-for="dotIndex in Object.keys(items).length"
        :key="dotIndex"
        :index="dotIndex - 1"
        style="cursor: pointer"
        @click="carouselIndex = dotIndex - 1"
      >
        {{ carouselIndex === dotIndex - 1 ? '\u25CF' : '\u25CB' }}
      </span>
    </div>
  </v-ons-page>
</template>

<script>
export default {
  data() {
    return {
      carouselIndex: 0,
      items: {
        BLUE: '#085078',
        DARK: '#373B44',
        ORANGE: '#D38312',
      },
      dots: {
        textAlign: 'center',
        fontSize: '30px',
        color: '#fff',
        position: 'absolute',
        bottom: '40px',
        left: 0,
        right: 0,
      },
    }
  },
  methods: {
    handleClick() {
      this.$store.commit('navigator/pop')
    },
  },
}
</script>

<style scoped>
ons-carousel-item {
  display: table;
  text-align: center;
}

.item-label {
  display: table-cell;
  vertical-align: middle;
  color: white;
  line-height: 1;
  font-size: 48px;
  font-weight: bold;
}

.cover-label {
  text-align: center;
  position: absolute;
  left: 0px;
  width: 100%;
  bottom: 10px;
  color: white;
}

.toggler-prev {
  pointer-events: auto;
  cursor: pointer;
  float: left;
  margin-left: 20px;
  width: 40px;
  margin-top: 40px;
  color: white;
}

.toggler-next {
  pointer-events: auto;
  cursor: pointer;
  float: right;
  margin-right: 20px;
  width: 40px;
  margin-top: 40px;
  color: white;
}
</style>
