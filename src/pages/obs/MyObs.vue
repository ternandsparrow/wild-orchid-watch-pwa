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
      <div v-if="isDoingSync" class="updating-msg text-center">
        Synchronising with server
      </div>
      <div v-if="isNoRecords" class="no-records-msg">
        You haven't submitted any Observations, so far..
      </div>
      <v-ons-list v-if="!isNoRecords">
        <v-ons-list-header
          v-if="isShowDeleteDetails"
          class="waiting-for-delete-header"
        >
          <span v-if="waitingForDeleteCount"
            ><strong>{{ waitingForDeleteCount }}</strong> pending record
            delete(s).</span
          >
          <div v-if="isSyncDisabled">
            (Sync <span class="red">disabled</span> in settings)
          </div>
          <div v-if="deletesWithErrorCount">
            <div>
              <span class="red">Error</span> while deleting
              <strong>{{ deletesWithErrorCount }}</strong> record(s) on server.
            </div>
            <div class="delete-fail-button-container">
              <v-ons-button @click="retryFailedDeletes">Retry</v-ons-button>
              <v-ons-button modifier="outline " @click="cancelFailedDeletes"
                >Cancel deletes</v-ons-button
              >
            </div>
          </div>
        </v-ons-list-header>
        <v-ons-list-header v-if="isWaitingForUpload"
          >Waiting to upload
          <span v-if="isSyncDisabled"
            >(Sync <span class="red">disabled</span> in settings)</span
          >
          <span v-if="!networkOnLine && !isSyncDisabled"
            >(Will retry when we're back online)</span
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
    <v-ons-fab position="bottom right" @click="onNewSingleSpecies">
      <v-ons-icon icon="md-plus"></v-ons-icon>
    </v-ons-fab>
  </v-ons-page>
</template>

<script>
import { mapState, mapGetters } from 'vuex'

export default {
  data() {
    return {
      pullHookState: 'initial',
    }
  },
  computed: {
    ...mapGetters(['isSyncDisabled']),
    ...mapGetters('auth', ['isUserLoggedIn']),
    ...mapState('ephemeral', ['networkOnLine']),
    ...mapGetters('obs', [
      'deletesWithErrorCount',
      'isDoingSync',
      'isRemoteObsStale',
      'localRecords',
      'remoteRecords',
      'waitingForDeleteCount',
    ]),
    isWaitingForUpload() {
      return (this.localRecords || []).length
    },
    isNoRecords() {
      return (this.remoteRecords || []).length === 0 && !this.isWaitingForUpload
    },
    isShowDeleteDetails() {
      return this.waitingForDeleteCount || this.deletesWithErrorCount
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
    onNewSingleSpecies() {
      this.$store.commit('obs/setSelectedObservationId', null)
      this.$router.push({ name: 'ObsNewSingleSpecies' })
    },
    doRefresh(done) {
      if (!this.networkOnLine) {
        this.$ons.notification.toast('Cannot refresh while offline', {
          timeout: 3000,
          animation: 'fall',
        })
      } else if (this.isUserLoggedIn) {
        this.$store.dispatch('obs/refreshRemoteObs')
        this.$store.dispatch('obs/processLocalQueue')
      }
      done && done()
    },
    // TODO it might be nice to be able to retry/cancel failed deletes
    // individually rather than all at once.
    retryFailedDeletes() {
      this.$store.dispatch('obs/retryFailedDeletes')
    },
    cancelFailedDeletes() {
      this.$store.dispatch('obs/cancelFailedDeletes')
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

.waiting-for-delete-header {
  background-color: #ffd384;
}

.delete-fail-button-container {
  display: flex;
  justify-content: space-around;
  padding-bottom: 1em;
}
</style>
