<template>
  <v-ons-page>
    <custom-toolbar back-label="Home" title="Observation">
      <template v-slot:right>
        <v-ons-toolbar-button @click="onEdit">
          Edit
        </v-ons-toolbar-button>
        <v-ons-toolbar-button @click="onActionMenu">
          <v-ons-icon icon="fa-ellipsis-v"></v-ons-icon
        ></v-ons-toolbar-button>
      </template>
    </custom-toolbar>
    <!-- FIXME add user and timestamp -->

    <v-ons-card>
      <v-ons-carousel
        v-if="isPhotos"
        auto-scroll
        auto-scroll-ratio="0.2"
        swipeable
        overscrollable
        :index.sync="carouselIndex"
      >
        <!-- FIXME change ratio to landscape and images should "cover" -->
        <v-ons-carousel-item v-for="curr of photos" :key="curr">
          <div class="photo-container">
            <img class="a-photo" :src="curr" alt="an observation photo" />
          </div>
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
      <!-- FIXME add link to species record -->
      <div class="title">{{ nullSafeObs.speciesGuess }}</div>
    </v-ons-card>
    <relative-tabbar
      :tab-index="selectedTab"
      :tabs="tabs"
      @update:tabIndex="selectedTab = $event"
    ></relative-tabbar>
    <div class="tab-container">
      <div v-if="selectedTab === 0">
        <h3>Notes</h3>
        <!-- FIXME replace this with description? -->
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed dignissim
        mi euismod massa gravida pretium. Cras quis lorem nec sapien pulvinar
        semper.
        <div class="map-container text-center">
          <google-map :marker-position="testPosition" />
        </div>
      </div>
      <div v-if="selectedTab === 1">
        <p class="text-center" style="color: red;">
          TODO add identifications and comments
        </p>
      </div>
      <div v-if="selectedTab === 2">
        <p class="text-center" style="color: red;">
          TODO add button for starring
        </p>
      </div>
    </div>
  </v-ons-page>
</template>

<script>
import { mapGetters } from 'vuex'
import { noImagePlaceholderUrl } from '@/misc/constants'

export default {
  name: 'ObsDetail',
  data() {
    return {
      noImagePlaceholderUrl,
      carouselIndex: 0,
      extraDotsStyle: {
        position: 'relative',
        top: '-2em',
      },
      selectedTab: 0,
      tabs: [{ icon: 'fa-info' }, { icon: 'fa-comments' }, { icon: 'fa-star' }],
      testPosition: { lat: -34.9786554, lng: 138.6487938 }, // FIXME pull real location
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

.map-container {
  padding: 2em 0;
}

.map-container img {
  width: 90vw;
}

.tab-container {
  padding: 0 5px;
}

.tabbar-fixer ons-tabbar,
.tabbar-fixer ons-tab {
  position: relative;
}
</style>
