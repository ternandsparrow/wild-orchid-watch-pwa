<template>
  <v-ons-page>
    <v-ons-list>
      <v-ons-list-header v-if="isWaitingForUpload"
        >Waiting to upload</v-ons-list-header
      >
      <!-- FIXME remove duplication from next section -->
      <v-ons-list-item
        v-for="curr in waitingToUploadRecords"
        :key="curr.id"
        @click="push(curr.id)"
      >
        <div class="left">
          <img class="list-item__thumbnail" :src="firstPhoto(curr)" />
        </div>
        <div class="center">
          <span class="list-item__title">{{ curr.speciesGuess }}</span
          ><span class="list-item__subtitle">{{ curr.placeGuess }}</span>
        </div>
      </v-ons-list-item>
      <v-ons-list-header v-if="isWaitingForUpload">Uploaded</v-ons-list-header>
      <v-ons-list-item
        v-for="curr in myObs"
        :key="curr.id"
        class="wow-list-item"
        @click="push(curr.id)"
      >
        <div class="left">
          <img class="list-item__thumbnail" :src="firstPhoto(curr)" />
        </div>
        <div class="center wow-list-item">
          <span class="list-item__title">{{ curr.speciesGuess }}</span
          ><span class="list-item__subtitle">{{ curr.placeGuess }}</span>
        </div>
      </v-ons-list-item>
    </v-ons-list>
    <v-ons-fab position="bottom right" @click="onNewObsBtn">
      <v-ons-icon icon="md-plus"></v-ons-icon>
    </v-ons-fab>
    <v-ons-action-sheet :visible.sync="isNewObsActionsVisible" cancelable>
      <v-ons-action-sheet-button @click="onIndividual"
        >Individual</v-ons-action-sheet-button
      >
      <v-ons-action-sheet-button @click="onPopulation"
        >Population</v-ons-action-sheet-button
      >
      <!-- FIXME on ios, the last option looks different -->
      <v-ons-action-sheet-button @click="onMapping"
        >Mapping</v-ons-action-sheet-button
      >
    </v-ons-action-sheet>
  </v-ons-page>
</template>

<script>
import { mapState } from 'vuex'
import ObsDetailComponent from '@/pages/ObservationDetail'
import Individual from '@/pages/new-obs/Individual'
import Population from '@/pages/new-obs/Population'
import Mapping from '@/pages/new-obs/Mapping'
import { noImagePlaceholderUrl } from '@/misc/constants'

export default {
  data() {
    return {
      isNewObsActionsVisible: false,
    }
  },
  computed: {
    ...mapState('obs', ['myObs', 'waitingToUploadRecords']),
    isWaitingForUpload() {
      return (this.waitingToUploadRecords || []).length
    },
  },
  created() {
    this.$store.dispatch('obs/getMyObs')
    this.$store.dispatch('obs/refreshWaitingToUpload')
  },
  methods: {
    push(obsId) {
      this.$store.commit('obs/setSelectedObservationId', obsId)
      this.$store.commit('navigator/push', ObsDetailComponent)
    },
    onNewObsBtn() {
      this.isNewObsActionsVisible = true
    },
    onIndividual() {
      this.isNewObsActionsVisible = false
      this.$store.commit('navigator/push', Individual)
    },
    onPopulation() {
      this.isNewObsActionsVisible = false
      this.$store.commit('navigator/push', Population)
    },
    onMapping() {
      this.isNewObsActionsVisible = false
      this.$store.commit('navigator/push', Mapping)
    },
    firstPhoto(record) {
      if (!record || !record.photos || !record.photos.length) {
        return noImagePlaceholderUrl
      }
      return record.photos[0]
    },
  },
}
</script>

<style lang="scss" scoped>
@import '@/theme/variables.scss';
.wow-list-item {
  background-color: $wowLightLightBlue;
}
</style>
