<template>
  <v-ons-page>
    <div>
      <no-records-msg v-if="isNoRecords" />
      <v-ons-list v-if="!isNoRecords">
        <v-ons-list-header v-if="isWaitingForUpload"
          >Waiting to upload</v-ons-list-header
        >
        <!-- FIXME remove duplication from next section -->
        <v-ons-list-item
          v-for="curr in waitingToUploadRecords"
          :key="curr.id"
          modifier="chevron"
          @click="push(curr.id)"
        >
          <div class="left">
            <img class="list-item__thumbnail" :src="firstPhoto(curr)" />
          </div>
          <div class="center">
            <span class="list-item__title">{{ speciesGuess(curr) }}</span
            ><span class="list-item__subtitle">{{ placeGuess(curr) }}</span>
          </div>
        </v-ons-list-item>
        <v-ons-list-header v-if="isWaitingForUpload"
          >Uploaded</v-ons-list-header
        >
        <v-ons-list-item
          v-for="curr in myObs"
          :key="curr.id"
          modifier="chevron"
          @click="push(curr.id)"
        >
          <div class="left">
            <img class="list-item__thumbnail" :src="firstPhoto(curr)" />
          </div>
          <div class="center">
            <span class="list-item__title">{{ speciesGuess(curr) }}</span
            ><span class="list-item__subtitle">{{ placeGuess(curr) }}</span>
          </div>
        </v-ons-list-item>
      </v-ons-list>
    </div>
    <v-ons-fab position="bottom right" @click="onNewObsBtn">
      <v-ons-icon icon="md-plus"></v-ons-icon>
    </v-ons-fab>
    <v-ons-action-sheet :visible.sync="isNewObsActionsVisible" cancelable>
      <v-ons-action-sheet-button icon="fa-user-alt" @click="onIndividual"
        >Individual</v-ons-action-sheet-button
      >
      <v-ons-action-sheet-button icon="fa-users" @click="onPopulation"
        >Population</v-ons-action-sheet-button
      >
      <v-ons-action-sheet-button icon="fa-map-marked-alt" @click="onMapping"
        >Mapping</v-ons-action-sheet-button
      >
      <!-- Add a cancel button for iOS -->
      <v-ons-action-sheet-button
        v-if="!md"
        icon="fa-map-marked-alt"
        @click="isNewObsActionsVisible = false"
        >Cancel</v-ons-action-sheet-button
      >
    </v-ons-action-sheet>
  </v-ons-page>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import ObsDetailComponent from '@/pages/obs-detail'
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
    ...mapGetters('auth', ['myUserId']),
    ...mapState('auth', ['apiToken']),
    isWaitingForUpload() {
      return (this.waitingToUploadRecords || []).length
    },
    isNoRecords() {
      return (this.myObs || []).length === 0
    },
  },
  created() {
    this.$store.dispatch('obs/getMyObs', {
      myUserId: this.myUserId,
      apiToken: this.apiToken,
    })
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
    speciesGuess(record) {
      return record.speciesGuess || '(No species name)'
    },
    placeGuess(record) {
      return record.placeGuess || '(No place guess)'
    },
  },
}
</script>
