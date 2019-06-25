<template>
  <v-ons-page>
    <custom-toolbar back-label="Home" :title="nullSafeObs.speciesGuess">
      <template v-slot:right>
        <v-ons-toolbar-button @click="onEdit">
          Edit
        </v-ons-toolbar-button>
        <v-ons-toolbar-button @click="onActionMenu">
          <v-ons-icon icon="fa-ellipsis-v"></v-ons-icon
        ></v-ons-toolbar-button>
      </template>
    </custom-toolbar>

    <v-ons-card>
      <!-- FIXME add all photos as carousel -->
      <v-ons-carousel
        v-if="isPhotos"
        auto-scroll
        auto-scroll-ratio="0.2"
        swipeable
        overscrollable
        :index.sync="carouselIndex"
      >
        <v-ons-carousel-item v-for="curr of photos" :key="curr">
          <div class="photo-container">
            <img class="a-photo" :src="curr" alt="an observation photo" />
          </div>
          <!-- FIXME add dots -->
        </v-ons-carousel-item>
      </v-ons-carousel>
      <img
        v-if="!isPhotos"
        :src="noImagePlaceholderUrl"
        class="a-photo"
        alt="placeholder image as no photos are available"
      />
      <carousel-dots
        v-if="isShowDots"
        :dot-count="photos.length"
        :selected-index="carouselIndex"
        :extra-styles="extraDotsStyle"
        @dot-click="onDotClick"
      ></carousel-dots>
      <div class="title">{{ nullSafeObs.speciesGuess }}</div>
      <div class="content">
        <v-ons-list>
          <v-ons-list-header>Details</v-ons-list-header>
          <v-ons-list-item>{{ nullSafeObs.placeGuess }}</v-ons-list-item>
          <!-- FIXME get meta fields for our app -->
        </v-ons-list>
      </div>
    </v-ons-card>
  </v-ons-page>
</template>

<script>
import { mapGetters } from 'vuex'
import { noImagePlaceholderUrl } from '@/misc/constants'

export default {
  data() {
    return {
      noImagePlaceholderUrl,
      carouselIndex: 0,
      extraDotsStyle: {
        position: 'relative',
        top: '-2em',
      },
    }
  },
  computed: {
    ...mapGetters('obs', ['observationDetail']),
    nullSafeObs() {
      // FIXME is this a code smell?
      return this.observationDetail || {}
    },
    isPhotos() {
      return (this.nullSafeObs.photos || []).length
    },
    photos() {
      return (this.nullSafeObs.photos || []).map(e =>
        e.replace('square', 'medium'),
      )
    },
    isShowDots() {
      return this.photos.length > 1
    },
  },
  methods: {
    onDotClick(carouselIndex) {
      this.carouselIndex = carouselIndex
    },
    onActionMenu() {
      const menu = {
        Delete: () => {
          // FIXME handle when we're currently uploading this record
          // FIXME handle (or disable for) already uploaded records
          this.$ons.notification
            .confirm('Are you sure about deleting this record?')
            .then(answer => {
              if (!answer) {
                return
              }
              this.$store.dispatch('obs/deleteSelectedRecord')
              this.$store.commit('navigator/pop')
            })
        },
      }
      this.$ons
        .openActionSheet({
          buttons: Object.keys(menu),
          cancelable: true,
          destructive: 1,
        })
        .then(selIndex => {
          const key = Object.keys(menu)[selIndex]
          menu[key]()
        })
    },
    onEdit() {
      // FIXME swap to edit mode
      this.$ons.notification.alert('FIXME swap to edit mode')
    },
  },
}
</script>

<style scoped>
.a-photo {
  width: 100%;
}

.photo-container {
  height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #6b6b6b;
}
</style>
