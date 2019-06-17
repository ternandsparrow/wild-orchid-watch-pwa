<template>
  <v-ons-page>
    <v-ons-list>
      <v-ons-list-header>Recent</v-ons-list-header>
      <v-ons-list-item
        v-for="curr in myObs"
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

export default {
  data() {
    return {
      isNewObsActionsVisible: false,
    }
  },
  computed: {
    ...mapState('obs', ['myObs']),
  },
  created() {
    this.$store.dispatch('obs/getMyObs')
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
      if (!record || !record.obsPhotos || !record.obsPhotos.length) {
        return '../../assets/no-image-placeholder.png'
      }
      return record.obsPhotos[0].photo.url
    },
  },
}
</script>
