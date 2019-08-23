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
      <div v-if="isUpdatingRemoteObs" class="updating-msg text-center">
        Updating
      </div>
      <no-records-msg v-if="isNoRecords" />
      <v-ons-list v-if="!isNoRecords">
        <v-ons-list-header v-if="isWaitingForUpload"
          >Waiting to upload
          <span v-if="isSyncDisabled"
            >(Sync <span class="red">disabled</span> in settings)</span
          ></v-ons-list-header
        >
        <obs-list
          :records="localRecords"
          key-prefix="waiting-"
          @item-click="push"
        />
        <v-ons-list-header v-if="isWaitingForUpload"
          >Uploaded</v-ons-list-header
        >
        <obs-list :records="remoteRecords" @item-click="push" />
      </v-ons-list>
    </div>
    <v-ons-fab position="bottom right" @click="onNewObsBtn">
      <v-ons-icon icon="md-plus"></v-ons-icon>
    </v-ons-fab>
    <v-ons-action-sheet :visible.sync="isNewObsActionsVisible" cancelable>
      <v-ons-action-sheet-button icon="fa-seedling" @click="onNewSingleSpecies"
        >Single species</v-ons-action-sheet-button
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
    ...mapGetters(['isSyncDisabled']),
    ...mapGetters('auth', ['isUserLoggedIn']),
    // FIXME need to change to getters for remoteRecords and localRecords
    // We'll need to filter the remote records to exclude anything with local edits/deletes
    ...mapState('obs', ['isUpdatingRemoteObs']),
    ...mapGetters('obs', ['isRemoteObsStale', 'localRecords', 'remoteRecords']),
    isWaitingForUpload() {
      return (this.localRecords || []).length
    },
    isNoRecords() {
      return (this.remoteRecords || []).length === 0 && !this.isWaitingForUpload
    },
  },
  mounted() {
    if (this.isRemoteObsStale) {
      this.doRefresh()
    }
  },
  methods: {
    push(obsId) {
      this.$router.push({ name: 'ObsDetail', params: { id: obsId } })
    },
    onNewObsBtn() {
      this.isNewObsActionsVisible = true
    },
    onNewSingleSpecies() {
      this.isNewObsActionsVisible = false
      this.$router.push({ name: 'ObsNewSingleSpecies' })
    },
    doRefresh(done) {
      if (this.isUserLoggedIn) {
        this.$store.dispatch('obs/refreshRemoteObs')
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

.red {
  color: red;
}
</style>
