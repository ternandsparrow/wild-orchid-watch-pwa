<template>
  <v-ons-page>
    <v-ons-pull-hook
      :action="doRefresh"
      @changestate="pullHookState = $event.state"
    >
      <span v-show="pullHookState === 'initial'"> Pull to refresh </span>
      <span v-show="pullHookState === 'preaction'"> Release </span>
      <span v-show="pullHookState === 'action'"> Loading... </span>
    </v-ons-pull-hook>
    <div>
      <no-records-msg v-if="isNoRecords" />
      <v-ons-list v-if="!isNoRecords">
        <v-ons-list-header v-if="isWaitingForUpload"
          >Waiting to upload
          <span v-if="isUploadsDisabled"
            >(Uploads disabled in settings)</span
          ></v-ons-list-header
        >
        <!-- FIXME remove duplication from next section -->
        <!-- FIXME we can't push(curr.inatId) here, what do we do? -->
        <v-ons-list-item
          v-for="curr in waitingToUploadRecords"
          :key="'waiting-' + curr.id"
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
          @click="push(curr.inatId)"
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
      <!-- TODO support mapping records, and population if it needs a separate page -->
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
import { noImagePlaceholderUrl } from '@/misc/constants'

export default {
  data() {
    return {
      isNewObsActionsVisible: false,
      pullHookState: 'initial',
    }
  },
  computed: {
    ...mapGetters(['isUploadsDisabled']),
    ...mapState('auth', ['apiToken']),
    ...mapGetters('auth', ['isUserLoggedIn']),
    ...mapState('obs', ['myObs', 'waitingToUploadRecords']),
    ...mapGetters('obs', ['isMyObsStale']),
    isWaitingForUpload() {
      return (this.waitingToUploadRecords || []).length
    },
    isNoRecords() {
      return (this.myObs || []).length === 0
    },
  },
  mounted() {
    if (this.isMyObsStale) {
      this.doRefresh()
    }
    this.$store.dispatch('obs/refreshWaitingToUpload') // FIXME do we need this, it should be maintained elsewhere
  },
  methods: {
    push(obsId) {
      this.$router.push({ name: 'ObsDetail', params: { id: obsId } })
    },
    onNewObsBtn() {
      this.isNewObsActionsVisible = true
    },
    onIndividual() {
      this.isNewObsActionsVisible = false
      this.$router.push({ name: 'ObsNew' })
    },
    firstPhoto(record) {
      if (!record || !record.photos || !record.photos.length) {
        return noImagePlaceholderUrl
      }
      return record.photos[0].url
    },
    speciesGuess(record) {
      return record.speciesGuess || '(No species name)'
    },
    placeGuess(record) {
      return record.placeGuess || '(No place guess)'
    },
    async doRefresh(done) {
      if (this.isUserLoggedIn) {
        // FIXME need to cache-bust (user agent disk cache) for this and similar
        await this.$store.dispatch('obs/getMyObs')
      }
      done && done()
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
