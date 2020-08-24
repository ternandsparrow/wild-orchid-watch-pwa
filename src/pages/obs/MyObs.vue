<template>
  <menu-wrapper title="My Observations">
    <template v-slot:toolbar-right>
      <v-ons-toolbar-button id="toolbar-refresh-btn" @click="doRefresh">
        <v-ons-icon name="toolbar-refresh-btn" icon="fa-sync-alt"></v-ons-icon>
        Refresh
      </v-ons-toolbar-button>
    </template>
    <v-ons-pull-hook
      :action="doRefresh"
      @changestate="pullHookState = $event.state"
    >
      <span v-show="pullHookState === 'initial'"> Pull to refresh </span>
      <span v-show="pullHookState === 'preaction'"> Release </span>
      <span v-show="pullHookState === 'action'"> Loading... </span>
    </v-ons-pull-hook>
    <div>
      <v-ons-list>
        <v-ons-list-item expandable
          ><div class="center summary-bar">
            <div class="summary-item">
              <img src="@/assets/img/cloud-wait.svg" class="wow-icon" />
              {{ localRecords.length }}
              <span class="md-detail">Pending</span>
              <span class="lg-detail">Pending upload</span>
            </div>
            <div class="summary-item">
              <v-ons-icon
                v-if="isDoingSync"
                icon="fa-spinner"
                class="sync-spinner"
              ></v-ons-icon>
              <v-ons-icon v-else icon="fa-check-double"></v-ons-icon>
              <span class="sm-detail">
                {{ isDoingSync ? 'Sync' : 'Done' }}
              </span>
              <span class="md-detail">
                {{ isDoingSync ? 'Sync-ing' : 'Sync done' }}
              </span>
              <span class="lg-detail">
                Sync {{ isDoingSync ? 'in progress' : 'all done' }}
              </span>
            </div>
            <div class="summary-item">
              <v-ons-icon
                :class="{ red: !networkOnLine }"
                icon="fa-wifi"
              ></v-ons-icon>
              <span class="sm-detail">
                {{ networkOnLine ? 'Yes' : 'No' }}
              </span>
              <span class="md-detail">
                {{ networkOnLine ? 'Online' : 'Offline' }}
              </span>
              <span class="lg-detail">
                Network {{ networkOnLine ? 'Online' : 'Offline' }}
              </span>
            </div>
            <div class="summary-item">
              <v-ons-icon
                v-if="isSyncDisabled"
                icon="fa-ban"
                class="red"
              ></v-ons-icon>
              <v-ons-icon v-else icon="fa-cloud-upload-alt"></v-ons-icon>
              <span class="sm-detail">
                {{ isSyncDisabled ? 'Off' : 'On' }}
              </span>
              <span class="md-detail">
                Sync {{ isSyncDisabled ? 'Off' : 'On' }}
              </span>
              <span class="lg-detail">
                Synchronising {{ isSyncDisabled ? 'Off' : 'On' }}
              </span>
            </div>
            <div v-if="deletesWithErrorCount" class="delete-error-container">
              <div>
                <span class="red">Error</span> while deleting
                <strong>{{ deletesWithErrorCount }}</strong> record(s) on
                server.
              </div>
              <div class="delete-fail-button-container">
                <v-ons-button
                  name="retry-failed-deletes-btn"
                  @click="retryFailedDeletes"
                  >Retry</v-ons-button
                >
                <v-ons-button
                  name="cancel-failed-deletes-btn"
                  modifier="outline "
                  @click="cancelFailedDeletes"
                  >Cancel deletes</v-ons-button
                >
              </div>
            </div>
          </div>
          <div class="expandable-content">
            <div class="expand-item">
              <img src="@/assets/img/cloud-wait.svg" class="wow-icon" />
              {{ localRecords.length }} observations queued for sync
              <div v-if="waitingForDeleteCount">
                <strong>{{ waitingForDeleteCount }}</strong> pending observation
                delete(s).
              </div>
            </div>
            <div class="expand-item">
              <template v-if="isDoingSync">
                <v-ons-icon icon="fa-spinner" class="sync-spinner" />
                Synchronising observations with iNaturalist
              </template>
              <template v-else>
                <v-ons-icon icon="fa-check-double"></v-ons-icon>
                Synchronised with iNaturalist ({{ humanLastSyncDate }})
              </template>
            </div>
            <div class="expand-item">
              <v-ons-icon
                :class="{ red: !networkOnLine }"
                icon="fa-wifi"
              ></v-ons-icon>
              <span v-if="networkOnLine"> Network online</span>
              <span v-else> Network offline</span>
            </div>
            <div class="expand-item">
              <v-ons-icon
                v-if="isSyncDisabled"
                icon="fa-ban"
                class="red"
              ></v-ons-icon>
              <v-ons-icon v-else icon="fa-cloud-upload-alt"></v-ons-icon>
              <span v-if="isSyncDisabled">
                Sync with iNaturalist is <span class="red">disabled</span> (in
                Settings menu)
              </span>
              <span v-else> Sync with iNaturalist enabled</span>
            </div>
            <div class="expand-item">
              {{ allRecords.length }} total observations
            </div>
            <div>
              <v-ons-icon icon="fa-comment" class="obs-badges"> </v-ons-icon>
              count of comments on observation
            </div>
            <div>
              <v-ons-icon icon="fa-dna" class="obs-badges"> </v-ons-icon>
              count of IDs on observation
            </div>
          </div>
        </v-ons-list-item>
        <template v-if="!isNoRecords">
          <v-ons-list-item
            v-for="curr in allRecords"
            :key="(curr.isWaiting ? 'waiting-' : '') + curr._key"
            modifier="chevron"
            @click="push(curr)"
          >
            <div class="left">
              <img class="list-item__thumbnail" :src="firstPhoto(curr)" />
            </div>
            <div class="center">
              <span class="list-item__title"
                ><a>{{ speciesGuess(curr) }}</a></span
              ><span class="list-item__subtitle">{{ placeGuess(curr) }}</span>
              <span class="list-item__subtitle">{{ dateInfo(curr) }}</span>
              <span
                v-show="isSystemError(curr)"
                class="list-item__subtitle error-indicator"
                >Error uploading record</span
              >
              <span
                v-show="isPossiblyStuck(curr)"
                class="list-item__subtitle warn-indicator"
              >
                <v-ons-icon icon="fa-exclamation-triangle"></v-ons-icon>
                Possible problem</span
              >
              <div class="obs-badges">
                <img
                  v-if="curr.isWaiting"
                  src="@/assets/img/cloud-wait.svg"
                  class="wow-icon"
                />
                <span v-if="curr.commentCount" class="wow-badge">
                  <v-ons-icon icon="fa-comment"> </v-ons-icon>
                  {{ curr.commentCount }}
                </span>
                <span v-if="curr.idCount" class="wow-badge">
                  <v-ons-icon icon="fa-dna"> </v-ons-icon>
                  {{ curr.idCount }}
                </span>
              </div>
            </div>
          </v-ons-list-item>
        </template>
      </v-ons-list>
      <no-records-msg
        v-if="isNoRecords"
        fragment="You haven't created any observations"
      />
    </div>
    <v-ons-fab position="bottom right" @click="onNewSingleSpecies">
      <a><v-ons-icon icon="md-plus"></v-ons-icon></a>
    </v-ons-fab>
  </menu-wrapper>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import dayjs from 'dayjs'
import {
  humanDateString,
  isPossiblyStuck as isPossiblyStuckHelper,
  triggerSwWowQueue,
  wowIdOf,
} from '@/misc/helpers'
import * as constants from '@/misc/constants'
import { isObsSystemError, extractGeolocationText } from '@/store/obs'

export default {
  name: 'MyObs',
  data() {
    return {
      pullHookState: 'initial',
    }
  },
  computed: {
    ...mapGetters(['isSyncDisabled']),
    ...mapGetters('auth', ['isUserLoggedIn']),
    ...mapState('ephemeral', ['networkOnLine']),
    ...mapState('obs', ['allRemoteObsLastUpdated', 'uuidsInSwQueues']),
    ...mapGetters('obs', [
      'deletesWithErrorCount',
      'isDoingSync',
      'isRemoteObsStale',
      'localRecords',
      'remoteRecords',
      'waitingForDeleteCount',
    ]),
    humanLastSyncDate() {
      return dayjs(this.allRemoteObsLastUpdated).format('DD-MMM-YYYY HH:mm')
    },
    isNoRecords() {
      return (this.allRecords || []).length === 0
    },
    isShowDeleteDetails() {
      return this.waitingForDeleteCount || this.deletesWithErrorCount
    },
    allRecords() {
      return [
        ...this.localRecords.map(r => ({
          ...r,
          isWaiting: true,
        })),
        ...this.remoteRecords.map(r => ({
          ...r,
          commentCount: (r.comments || []).length,
          idCount: (r.identifications || []).length,
        })),
      ].map(e => ({
        ...e,
        _key: wowIdOf(e),
      }))
    },
  },
  mounted() {
    if (this.isRemoteObsStale) {
      this.doRefresh()
    }
  },
  methods: {
    push(record) {
      const obsId = wowIdOf(record)
      this.$router.push({ name: 'ObsDetail', params: { id: obsId } })
    },
    onNewSingleSpecies() {
      this.$wow.uiTrace('MyObs', 'new single species')
      this.$store.commit('obs/setSelectedObservationUuid', null)
      this.$router.push({ name: 'ObsNewSingleSpecies' })
    },
    traceRefreshAction(done) {
      const msg = (() => {
        switch (typeof done) {
          case 'function':
            return 'pull refresh'
          case 'object':
            return 'click refresh'
          case 'undefined':
            return 'programatic refresh'
          default:
            return '(unknown type of) refresh'
        }
      })()
      this.$wow.uiTrace('MyObs', msg)
    },
    doRefresh(done) {
      this.traceRefreshAction(done)
      if (!this.networkOnLine) {
        this.$ons.notification.toast('Cannot refresh while offline', {
          timeout: 3000,
          animation: 'fall',
        })
      } else if (this.isUserLoggedIn) {
        this.$store
          .dispatch('obs/refreshRemoteObs')
          .then(() => this.$store.dispatch('obs/processLocalQueue'))
          .catch(err => {
            this.$store.dispatch(
              'flagGlobalError',
              {
                msg: `Failed to refresh observations`,
                err,
              },
              { root: true },
            )
          })
        triggerSwWowQueue()
      }
      done && typeof done === 'function' && done()
    },
    // TODO it might be nice to be able to retry/cancel failed deletes
    // individually rather than all at once.
    retryFailedDeletes() {
      this.$wow.uiTrace('MyObs', 'retry failed deletes')
      this.$store.dispatch('obs/retryFailedDeletes')
    },
    cancelFailedDeletes() {
      this.$wow.uiTrace('MyObs', 'cancel failed deletes')
      this.$store.dispatch('obs/cancelFailedDeletes')
    },
    firstPhoto(record) {
      if (!record || !record.photos || !record.photos.length) {
        return constants.noImagePlaceholderUrl
      }
      return record.photos[0].url
    },
    speciesGuess(record) {
      return record.speciesGuess || '(No species name)'
    },
    placeGuess(record) {
      return extractGeolocationText(record)
    },
    isSystemError(record) {
      return isObsSystemError(record)
    },
    dateInfo(r) {
      return humanDateString(r.observedAt)
    },
    isPossiblyStuck(record) {
      return isPossiblyStuckHelper(this.$store, record)
    },
  },
}
</script>

<style lang="scss" scoped>
@import '@/theme/variables.scss';
.red {
  color: red;
}

.delete-error-container {
  border: 1px solid red;
  border-radius: 10px;
  padding: 1em;
  margin-top: 1em;
  background-color: #ffe9ed;

  .delete-fail-button-container {
    display: flex;
    justify-content: space-around;
  }
}

.error-indicator {
  color: red;
}

.warn-indicator {
  color: $wowWarnOrange;
}

.obs-badges {
  color: #888;

  .wow-badge {
    margin-right: 0.2em;
    white-space: nowrap;
  }
}

.wow-icon {
  width: 26px;
  vertical-align: bottom;
}

.summary-bar {
  .summary-item {
    flex: 1 1 0;

    .sm-detail,
    .md-detail,
    .lg-detail {
      display: none;
    }

    @media only screen and (max-width: 459px) {
      .sm-detail {
        display: inline;
      }
    }

    @media only screen and (min-width: 460px) and (max-width: 699px) {
      .md-detail {
        display: inline;
      }
    }

    @media only screen and (min-width: 700px) {
      .lg-detail {
        display: inline;
      }
    }
  }
}

.sync-spinner {
  animation: spin 4s linear infinite;
}

@keyframes spin {
  100% {
    -webkit-transform: rotate(360deg);
    transform: rotate(360deg);
  }
}

.expand-item {
  padding: 0.5em 0;
  border-bottom: 1px solid #ddd;
}

@media only screen and (max-width: 700px) {
  #toolbar-refresh-btn {
    display: none;
  }
}
</style>
