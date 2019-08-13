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
      <div v-if="isUpdatingMyObs" class="updating-msg text-center">
        Updating
      </div>
      <no-records-msg v-if="isNoRecords" />
      <v-ons-list v-if="!isNoRecords">
        <v-ons-list-header v-if="isWaitingForUpload"
          >Waiting to upload
          <span v-if="isUploadsDisabled"
            >(Uploads disabled in settings)</span
          ></v-ons-list-header
        >
        <obs-list
          :records="waitingToUploadRecords"
          key-prefix="waiting-"
          @item-click="push"
        />
        <v-ons-list-header v-if="isWaitingForUpload"
          >Uploaded</v-ons-list-header
        >
        <obs-list :records="myObs" @item-click="push" />
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

export default {
  data() {
    return {
      isNewObsActionsVisible: false,
      pullHookState: 'initial',
    }
  },
  computed: {
    ...mapGetters(['isUploadsDisabled']),
    ...mapGetters('auth', ['isUserLoggedIn']),
    ...mapState('obs', ['myObs', 'waitingToUploadRecords', 'isUpdatingMyObs']),
    ...mapGetters('obs', ['isMyObsStale']),
    isWaitingForUpload() {
      return (this.waitingToUploadRecords || []).length
    },
    isNoRecords() {
      // TODO should we also check waitingToUploadRecords?
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
    doRefresh(done) {
      if (this.isUserLoggedIn) {
        this.$store.dispatch('obs/getMyObs')
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

.updating-msg {
  background-color: #98ffc1;
  color: #555;
  padding: 0.25em;
  font-size: 0.9em;
}
</style>
