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
      <div v-if="isShowJoinProjectAlert" class="info-alert join-info">
        <p>
          <v-ons-icon icon="fa-info-circle" />
          You need to join the WOW project on iNaturalist.
        </p>
        <p>
          Joining means your data can be used for scientific and conservation
          efforts. This is <em>the</em> reason that WOW exists!
        </p>
        <p class="text-center">
          <a :href="joinProjectReadMoreUrl" target="_blank" class="space-right">
            <v-ons-button modifier="quiet"
              ><v-ons-icon icon="fa-external-link-alt" /> Read
              more</v-ons-button
            >
          </a>
          <v-ons-button :disabled="isJoinButtonDisabled" @click="joinProject">
            <span v-show="!isJoinButtonDisabled">Join iNaturalist project</span>
            <span v-show="isJoinButtonDisabled">Joining</span>
          </v-ons-button>
        </p>
        <div v-if="joinProjectProcessingState === 'fail'" class="error-alert">
          Something went wrong when trying to join the project. You need an
          internet connection to perform this action. You can try again
          otherwise you can also join the project using the
          <a :href="inatJoinUrl" target="_blank">iNaturalist website</a>.
        </div>
      </div>
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
      </v-ons-list>
      <!-- Don't join these two lists because the menu bar gets sucked into the
        middle of the lazy-load -->
      <v-ons-list>
        <template v-if="isRecords">
          <v-ons-lazy-repeat
            :render-item="renderItem"
            :length="allRecords.length"
          >
          </v-ons-lazy-repeat>
        </template>
      </v-ons-list>
      <no-records-msg
        v-if="!isRecords"
        fragment="You haven't created any observations"
      />
    </div>
    <v-ons-fab position="bottom right" @click="onNewSingleSpecies">
      <a><v-ons-icon icon="md-plus"></v-ons-icon></a>
    </v-ons-fab>
  </menu-wrapper>
</template>

<script>
import Vue from 'vue'
import { mapState, mapGetters } from 'vuex'
import dayjs from 'dayjs'
import { triggerSwWowQueue, wowErrorHandler, wowIdOf } from '@/misc/helpers'
import * as constants from '@/misc/constants'

export default {
  name: 'MyObs',
  data() {
    const parent = this
    return {
      pullHookState: 'initial',
      joinProjectProcessingState: 'initial',
      autoJoinGracePeriodExpired: false,
      renderItem: i =>
        new Vue({
          store: parent.$store,
          router: parent.$router,
          // this approach of dynamically compiling is required for the lazy-load
          // but at the cost of being harder to debug as vue devtools can't
          // inspect the components. We have the minimum code here and push as
          // much as possible into a .vue file so it's nicer to code.
          data() {
            return {
              record: parent.allRecords[i],
            }
          },
          template: `
            <wow-obs-list-item :record="record" />
          `,
        }),
    }
  },
  computed: {
    ...mapGetters(['isSyncDisabled', 'isJoinedProject']),
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
    isRecords() {
      return (this.allRecords || []).length > 0
    },
    isShowDeleteDetails() {
      return this.waitingForDeleteCount || this.deletesWithErrorCount
    },
    allRecords() {
      return [
        ...this.localRecords.map(r => ({
          ...r,
          isWaiting:
            r.wowMeta[constants.recordProcessingOutcomeFieldName] ===
            constants.waitingOutcome,
          isDraft:
            r.wowMeta[constants.recordProcessingOutcomeFieldName] ===
            constants.draftOutcome,
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
    isShowJoinProjectAlert() {
      return (
        this.isUserLoggedIn &&
        this.autoJoinGracePeriodExpired &&
        !this.isJoinedProject
      )
    },
    joinProjectReadMoreUrl() {
      return 'https://www.wildorchidwatch.org/faqs/#who-has-access'
    },
    inatJoinUrl() {
      return `${constants.inatUrlBase}/projects/${constants.inatProjectSlug}/join`
    },
    isJoinButtonDisabled() {
      return ['processing', 'success'].includes(this.joinProjectProcessingState)
    },
  },
  mounted() {
    setTimeout(() => {
      // we need to let the auto-join happen and we don't want a flash of the
      // message to show if it's not needed
      this.autoJoinGracePeriodExpired = true
    }, 15000)
    if (this.isRemoteObsStale) {
      this.doRefresh()
    }
  },
  methods: {
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
    async joinProject() {
      try {
        this.joinProjectProcessingState = 'processing'
        this.$wow.uiTrace('MyObs', `user joined inat project from prompt`)
        const resp = await this.$store.dispatch('joinInatProject')
        console.debug('join project result', resp)
        this.joinProjectProcessingState = 'success'
        this.$ons.notification.toast('Succesfully joined project, thank you', {
          timeout: 5000,
          animation: 'fall',
        })
      } catch (err) {
        this.joinProjectProcessingState = 'fail'
        wowErrorHandler('Failed to join iNat project', err)
      }
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

.join-info {
  margin: 0.5em;
}

.space-right {
  margin-right: 1em;
}
</style>
