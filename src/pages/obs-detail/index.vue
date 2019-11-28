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

    <v-ons-card v-show="isSystemError" class="error-card">
      <div class="title">Error uploading record</div>
      <p>
        This is not your fault. Many issues could cause this but the first step
        is to try to upload the record again and see if that works.
      </p>
      <p>
        <v-ons-button @click="resetProcessingOutcome"
          >Retry upload</v-ons-button
        >
      </p>
    </v-ons-card>
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
      <div v-if="!isPhotos" class="photo-container">
        <div class="text-center no-photo">
          <p>No photos</p>
          <img
            :src="noImagePlaceholderUrl"
            class="a-photo"
            alt="placeholder image as no photos are available"
          />
        </div>
      </div>
      <carousel-dots
        v-if="isShowDots"
        :dot-count="photos.length"
        :selected-index="carouselIndex"
        :extra-styles="extraDotsStyle"
        @dot-click="onDotClick"
      ></carousel-dots>
      <!-- FIXME add link to species record -->
      <!-- FIXME show correct name based on prefers community ID or not -->
      <div class="title">{{ speciesNameText }}</div>
      <p class="wow-subtitle">
        Observed:<br />
        {{ observedDateInfoText }}
      </p>
    </v-ons-card>
    <relative-tabbar
      :tab-index="selectedTab"
      :tabs="tabs"
      @update:tabIndex="selectedTab = $event"
    ></relative-tabbar>
    <div class="tab-container">
      <div v-if="selectedTab === 0">
        <!-- FIXME show quality grade, quality metrics -->
        <!-- TODO show faves, flags, spam? -->
        <h3>Observation data</h3>
        <v-ons-list>
          <template v-for="curr of nullSafeObs.obsFieldValues">
            <v-ons-list-header
              :key="curr.fieldId + '-header'"
              class="wow-list-header"
              >{{ curr.name }}</v-ons-list-header
            >
            <v-ons-list-item
              :key="curr.fieldId + '-value'"
              modifier="nodivider"
              class="wow-list-item"
            >
              {{ curr.title }}
            </v-ons-list-item>
          </template>
          <v-ons-list-header class="wow-list-header">Notes</v-ons-list-header>
          <v-ons-list-item>
            <div v-show="nullSafeObs.notes">
              {{ nullSafeObs.notes }}
            </div>
            <div v-show="!nullSafeObs.notes" class="no-notes">
              (no notes)
            </div>
          </v-ons-list-item>
        </v-ons-list>
      </div>
      <div v-if="selectedTab === 1">
        <h3>Geolocation</h3>
        <!-- FIXME show obscurity box -->
        <!-- FIXME show accuracy circle -->
        <div v-if="obsCoords">
          <div class="map-container text-center">
            <google-map :marker-position="obsCoords" />
          </div>
          <h4>Details</h4>
          <table class="geolocation-detail">
            <tbody>
              <tr v-for="curr of geolocationDetails" :key="curr.label">
                <th>{{ curr.label }}</th>
                <td v-if="curr.value">{{ curr.value }}</td>
                <td v-if="!curr.value" class="no-value">(no value)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!obsCoords" class="text-center no-map-msg">
          No geolocation details available
          <div class="no-map-icon">
            <v-ons-icon icon="fa-frown" />
          </div>
        </div>
      </div>
      <!-- <div v-if="selectedTab === 2">                -->
      <!--   <p class="text-center" style="color: red;"> -->
      <!--     TODO add comments and identifications     -->
      <!--   </p>                                        -->
      <!-- </div>                                        -->
    </div>
  </v-ons-page>
</template>

<script>
import { mapGetters } from 'vuex'
import _ from 'lodash'
import {
  approxAreaSearchedObsFieldId,
  noImagePlaceholderUrl,
} from '@/misc/constants'
import {
  approxAreaSearchValueToTitle,
  formatMetricDistance,
  humanDateString,
  wowIdOf,
} from '@/misc/helpers'
import { isObsSystemError } from '@/store/obs'

export default {
  name: 'ObsDetail',
  data() {
    return {
      noImagePlaceholderUrl,
      carouselIndex: 0,
      extraDotsStyle: {
        color: '#5d5d5d',
      },
      selectedTab: 0,
      tabs: [
        { icon: 'fa-info' },
        { icon: 'fa-map-marked-alt' },
        // { icon: 'fa-comments' }, FIXME uncomment when we get the content
      ],
      obsFieldSorterFn: null,
    }
  },
  computed: {
    ...mapGetters('obs', ['observationDetail', 'isSelectedRecordEditOfRemote']),
    isSystemError() {
      return isObsSystemError(this.nullSafeObs)
    },
    nullSafeObs() {
      const valueMappers = {
        [approxAreaSearchedObsFieldId]: approxAreaSearchValueToTitle,
      }
      const result = _.cloneDeep(this.observationDetail || {})
      if (result.obsFieldValues) {
        result.obsFieldValues = result.obsFieldValues.map(e => {
          const val = e.value
          const defaultStrat = v => v
          const strategy = valueMappers[e.fieldId] || defaultStrat
          return {
            ...e,
            title: strategy(val),
          }
        })
        const targetField = 'fieldId'
        if (this.obsFieldSorterFn) {
          // no error on initial run, the real sorter will be used though
          this.obsFieldSorterFn(result.obsFieldValues, targetField)
        }
      }
      return result
    },
    isPhotos() {
      return (this.nullSafeObs.photos || []).length
    },
    photos() {
      return (this.nullSafeObs.photos || []).map(e =>
        e.url.replace('square', 'medium'),
      )
    },
    isShowDots() {
      return this.photos.length > 1
    },
    geolocationDetails() {
      const config = {
        Latitude: this.nullSafeObs.lat,
        Longitude: this.nullSafeObs.lng,
        Accuracy: formatMetricDistance(this.nullSafeObs.geolocationAccuracy),
        Geoprivacy: this.nullSafeObs.geoprivacy,
      }
      return Object.keys(config).map(k => ({
        label: k,
        value: config[k],
      }))
    },
    obsCoords() {
      const result = {
        lat: this.nullSafeObs.lat,
        lng: this.nullSafeObs.lng,
      }
      if (result.lat && result.lng) {
        return result
      }
      return null
    },
    speciesNameText() {
      return this.nullSafeObs.speciesGuess || '(No species name)'
    },
    observedDateInfoText() {
      return humanDateString(this.nullSafeObs.observedAt)
    },
  },
  watch: {
    '$route.params.id'(val) {
      // should be able to use beforeRouteUpdate() instead, but couldn't get it to work
      this.$store.commit('obs/setSelectedObservationId', val)
    },
  },
  async created() {
    this.obsFieldSorterFn = await this.$store.dispatch(
      'obs/buildObsFieldSorter',
    )
  },
  methods: {
    resetProcessingOutcome() {
      this.$store
        .dispatch('obs/resetProcessingOutcomeForSelectedRecord')
        .then(() => {
          this.$ons.notification.toast('Retrying upload', {
            timeout: 3000,
            animation: 'ascend',
          })
        })
        .catch(err => {
          this.$store.dispatch(
            'flagGlobalError',
            {
              msg: 'Failed to reset processing outcome after error',
              userMsg: 'Error while retrying upload',
              err,
            },
            { root: true },
          )
        })
      this.$router.push({ name: 'Home' })
    },
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
              this.$store
                .dispatch('obs/deleteSelectedRecord')
                .then(() => {
                  this.$ons.notification.toast('Record deleted!', {
                    timeout: 3000,
                    animation: 'ascend',
                  })
                })
                .catch(err => {
                  this.handleMenuError(err, {
                    msg: 'Failed to (completely) delete record',
                    userMsg: 'Error while deleting record.',
                  })
                })
              this.$router.push({ name: 'Home' })
            })
        },
      }
      if (this.isSelectedRecordEditOfRemote) {
        menu['Delete only local edit'] = () => {
          // FIXME handle when we're currently uploading this record
          this.$ons.notification
            .confirm(
              'This record has an edit that has NOT yet been ' +
                'synchronised to the server. Do you want to delete only the local ' +
                'changes so the record on the server stays unchanged?',
            )
            .then(answer => {
              if (!answer) {
                return
              }
              this.$store
                .dispatch('obs/deleteSelectedLocalEditOnly')
                .then(() => {
                  this.$ons.notification.toast('Local edit deleted!', {
                    timeout: 3000,
                    animation: 'ascend',
                  })
                })
                .catch(err => {
                  this.handleMenuError(err, {
                    msg: 'Failed to delete local edit on remote record',
                    userMsg: 'Error while deleting local edit.',
                  })
                })
              this.$router.push({ name: 'Home' })
            })
        }
      }
      if (!this.md) {
        menu.Cancel = () => {}
      }
      this.$ons
        .openActionSheet({
          buttons: Object.keys(menu),
          cancelable: true,
          destructive: 1,
        })
        .then(selIndex => {
          const key = Object.keys(menu)[selIndex]
          const selectedItemFn = menu[key]
          selectedItemFn && selectedItemFn()
        })
    },
    handleMenuError(err, { msg, userMsg }) {
      this.$store.dispatch(
        'flagGlobalError',
        { msg, userMsg, err },
        { root: true },
      )
    },
    onEdit() {
      const obsId = wowIdOf(this.nullSafeObs)
      this.$router.push({ name: 'ObsEdit', params: { id: obsId } })
    },
  },
}
</script>

<style scoped lang="scss">
.a-photo {
  max-width: 100%;
}

.no-photo {
  p {
    color: #666;
  }

  img {
    border-radius: 20px;
  }
}

.photo-container {
  height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e4e4e4;
}

.map-container {
  padding: 0;

  img {
    width: 90vw;
  }
}

.tab-container {
  padding: 0 5px;
  margin-bottom: 1em;
}

.tabbar-fixer ons-tabbar,
.tabbar-fixer ons-tab {
  position: relative;
}

.no-notes {
  color: #999;
}

table.geolocation-detail {
  background: #fff;
  width: 90vw;
  margin: 0 auto;

  th {
    width: 30vw;
    text-align: right;
  }

  td {
    text-align: left;
    padding-left: 1em;
    font-family: monospace;
  }
}

.no-value {
  color: #777;
}

.no-map-msg {
  color: #777;

  .no-map-icon {
    font-size: 3em;
    color: #bbb;
  }
}

.error-card {
  background-color: #ffe4e8;
  color: red;
}

.wow-subtitle {
  color: #666;
}
</style>
