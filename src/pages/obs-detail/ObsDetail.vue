<template>
  <v-ons-page>
    <custom-toolbar back-label="Home" title="Observation">
      <template v-slot:right>
        <v-ons-toolbar-button name="toolbar-edit-btn" @click="onEdit">
          Edit
        </v-ons-toolbar-button>
        <v-ons-toolbar-button
          name="toolbar-action-btn"
          @click="onMainActionMenu"
        >
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
        <v-ons-button
          name="retry-error-upload-btn"
          @click="resetProcessingOutcomeFromSystemError"
          >Retry upload</v-ons-button
        >
      </p>
    </v-ons-card>
    <v-ons-card v-show="isPossiblyStuck" class="warn-card">
      <div class="title">Possible problem</div>
      <p>
        It looks like this observation might be stuck while trying to upload to
        the server. This can happen when this app is closed/crashes midway
        through uploading.
      </p>
      <p>
        You can choose to do nothing and see if it eventually solves itself.
        This option will remain available as long as we think it's stuck.
      </p>
      <p>
        <v-ons-button
          name="retry-stuck-upload-btn"
          @click="resetProcessingOutcomeFromStuck"
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
        <v-ons-carousel-item v-for="curr of photos" :key="curr.id">
          <div class="photo-container">
            <img
              class="a-photo"
              :src="curr.url"
              alt="an observation photo"
              @click="showPhotoPreview(curr.url)"
            />
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
            <template v-if="isDetailedUserMode || !curr.isDetailedMode">
              <v-ons-list-header
                :key="curr.fieldId + '-header'"
                class="wow-list-header"
                >{{ curr.name }}</v-ons-list-header
              >
              <v-ons-list-item
                :key="curr.fieldId + '-value'"
                modifier="nodivider"
                class="wow-list-item"
                :class="{
                  'multiselect-container': curr.multiselectId,
                }"
              >
                <span v-if="!curr.multiselectId"> {{ curr.title }}</span>
                <div v-else>
                  <div
                    v-for="currMultiselectValue of curr.multiselectValues"
                    :key="currMultiselectValue.name"
                    class="multiselect-value"
                  >
                    <div class="const-ms-width">
                      <div v-if="currMultiselectValue.value === yesValue">
                        <v-ons-icon icon="fa-check" class="yes"></v-ons-icon>
                      </div>
                      <div v-else-if="currMultiselectValue.value === noValue">
                        <v-ons-icon icon="fa-times" class="no"></v-ons-icon>
                      </div>
                      <div v-else>{{ currMultiselectValue.value }}</div>
                    </div>
                    <div class="multiselect-question">
                      {{ currMultiselectValue.name }}
                    </div>
                  </div>
                </div>
              </v-ons-list-item>
            </template>
          </template>
          <template v-if="isDetailedUserMode">
            <v-ons-list-header class="wow-list-header">Notes</v-ons-list-header>
            <v-ons-list-item>
              <div v-show="nullSafeObs.notes">
                {{ nullSafeObs.notes }}
              </div>
              <div v-show="!nullSafeObs.notes" class="no-notes">
                (no notes)
              </div>
            </v-ons-list-item>
          </template>
        </v-ons-list>
        <div class="inat-details">
          <div>Record UUID: {{ nullSafeObs.uuid }}</div>
          <template v-if="isSelectedRecordOnRemote">
            <div>iNat ID: {{ nullSafeObs.inatId }}</div>
            <div>Updated at: {{ nullSafeObs.updatedAt }}</div>
            <div>
              <a :href="obsOnInatUrl" target="_blank">View on iNaturalist</a>
            </div>
          </template>
        </div>
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
      <div v-if="selectedTab === 2">
        <h3>Identifications and comments</h3>
        <div v-if="isNoIdsOrComments" class="no-records-msg">
          <span v-if="isSelectedRecordOnRemote"
            >There are no identifications or comments, so far...</span
          >
          <span v-if="!isSelectedRecordOnRemote"
            >Identifications and comments are not available until the
            observation has been uploaded to the server.</span
          >
        </div>
        <v-ons-list v-if="!isNoIdsOrComments">
          <template v-for="curr of nullSafeObs.idsAndComments">
            <template v-if="curr.wowType === 'identification'">
              <v-ons-list-header
                :key="curr.uuid + '-header'"
                class="wow-list-header interaction-header"
                :class="{ withdrawn: !curr.isCurrent }"
              >
                <span v-if="curr.isCurrent" class="category">{{
                  curr.category
                }}</span>
                <span v-if="!curr.isCurrent" class="category"
                  >ID Withdrawn</span
                >
                <strong>{{ curr.userLogin }}</strong> suggested an ID
              </v-ons-list-header>
              <v-ons-list-item :key="curr.uuid + '-item'">
                <div class="left">
                  <img
                    class="list-item__thumbnail"
                    :src="identificationPhotoUrl(curr)"
                  />
                </div>
                <div class="center">
                  <span
                    class="list-item__title wow-identification-title"
                    :class="{ withdrawn: !curr.isCurrent }"
                    >{{ curr.taxonCommonName }}</span
                  >
                  <span
                    class="list-item__subtitle"
                    :class="{ withdrawn: !curr.isCurrent }"
                    >{{ curr.taxonLatinName }}</span
                  >
                  <span class="list-item__subtitle">{{
                    dateInfo(curr.createdAt)
                  }}</span>
                  <p class="identification-comment">{{ curr.body }}</p>
                </div>
              </v-ons-list-item>
            </template>
            <template v-else-if="curr.wowType === 'comment'">
              <v-ons-list-header
                :key="curr.uuid + '-header'"
                class="wow-list-header interaction-header"
              >
                <strong>{{ curr.userLogin }}</strong> commented
              </v-ons-list-header>
              <v-ons-list-item :key="curr.uuid + '-item'">
                <div class="center">
                  <span class="list-item__subtitle">{{
                    dateInfo(curr.createdAt)
                  }}</span>
                  <p class="identification-comment">{{ curr.body }}</p>
                </div>
                <div class="right">
                  <v-ons-button
                    name="comment-menu-btn"
                    modifier="quiet"
                    @click="onCommentActionMenu(curr)"
                  >
                    <v-ons-icon icon="fa-ellipsis-v" class="muted" />
                  </v-ons-button>
                </div>
              </v-ons-list-item>
            </template>
            <template v-else>
              <h1 :key="curr.uuid + '-error'" style="color: red;">
                Programmer problem - unsupported type {{ curr.wowType }}
              </h1>
            </template>
          </template>
        </v-ons-list>
        <v-ons-list
          v-if="isSelectedRecordOnRemote"
          class="new-comment-container"
        >
          <wow-header label="Leave comment" />
          <v-ons-list-item>
            <p class="muted">
              <v-ons-icon icon="fa-info-circle" /> Currently you can only
              comment when you have an internet connection, not when offline.
            </p>
            <textarea
              v-model="newCommentBody"
              :disabled="isSavingComment"
              placeholder="Leave a comment"
              class="wow-textarea"
            >
            </textarea>
            <div class="text-right comment-button-container">
              <v-ons-button
                name="save-comment-btn"
                :disabled="isSavingComment"
                @click="onNewComment"
              >
                <span v-if="isSavingComment">Saving...</span>
                <span v-if="!isSavingComment">Done</span>
              </v-ons-button>
            </div>
          </v-ons-list-item>
        </v-ons-list>
      </div>
    </div>
    <wow-photo-preview />
    <v-ons-alert-dialog :visible.sync="isShowCommentEditModal">
      <span slot="title">Edit comment</span>
      <div class="edit-modal">
        <textarea
          v-model="editCommentRecord.body"
          :disabled="isSavingComment"
          class="wow-textarea edit-textarea"
        >
        </textarea>
      </div>
      <template slot="footer">
        <v-ons-alert-dialog-button
          name="cancel-comment-edit-btn"
          :disabled="isSavingComment"
          @click="onCancelEditComment"
          >Cancel</v-ons-alert-dialog-button
        >
        <v-ons-alert-dialog-button
          name="save-comment-edit-btn"
          :disabled="isSavingComment"
          @click="onSaveEditComment"
        >
          <span v-if="isSavingComment">Saving...</span>
          <span v-if="!isSavingComment">Save</span>
        </v-ons-alert-dialog-button>
      </template>
    </v-ons-alert-dialog>
  </v-ons-page>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import _ from 'lodash'
import {
  approxAreaSearchedObsFieldId,
  areaOfPopulationObsFieldId,
  getMultiselectId,
  inatUrlBase,
  noImagePlaceholderUrl,
  noValue,
  notCollected,
  yesValue,
} from '@/misc/constants'
import {
  findCommonString,
  formatMetricDistance,
  humanDateString,
  isPossiblyStuck,
  rectangleAlongPathAreaValueToTitle,
  wowErrorHandler,
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
        { icon: 'fa-comments' },
      ],
      obsFieldSorterFn: null,
      yesValue,
      noValue,
      newCommentBody: null,
      isSavingComment: false,
      editCommentRecord: {},
      isShowCommentEditModal: false,
    }
  },
  computed: {
    ...mapGetters('obs', [
      'detailedModeOnlyObsFieldIds',
      'isSelectedRecordEditOfRemote',
      'isSelectedRecordOnRemote',
      'observationDetail',
    ]),
    ...mapState('ephemeral', ['isPhotoPreviewModalVisible']),
    ...mapState('app', ['isDetailedUserMode']),
    isSystemError() {
      return isObsSystemError(this.nullSafeObs)
    },
    isPossiblyStuck() {
      return isPossiblyStuck(this.$store, this.observationDetail)
    },
    selectedObsInatId() {
      return this.observationDetail.inatId
    },
    nullSafeObs() {
      const valueMappers = {
        [approxAreaSearchedObsFieldId]: rectangleAlongPathAreaValueToTitle,
        [areaOfPopulationObsFieldId]: rectangleAlongPathAreaValueToTitle,
      }
      const result = _.cloneDeep(this.observationDetail || {})
      if (result.obsFieldValues) {
        result.obsFieldValues = result.obsFieldValues.reduce((accum, curr) => {
          const val = curr.value
          const defaultStrat = v => v
          const strategy = valueMappers[curr.fieldId] || defaultStrat
          const mappedValue = strategy(val)
          const multiselectId = getMultiselectId(curr.fieldId)
          const isMultiselect = !!multiselectId
          if (!isMultiselect) {
            accum.push({
              ...curr,
              title: mappedValue,
              isDetailedMode: (() => {
                // looking for == notCollected probably isn't the most robust
                // check. In a perfect world we would recreate the complex rules
                // around our conditionally required fields and use that knowledge
                // here. But this is easy and has the same effect because required
                // fields can't be not collected
                const isNotCollected = curr.value === notCollected
                const isDefinitelyDetailed = this.detailedModeOnlyObsFieldIds[
                  curr.fieldId
                ]
                return isDefinitelyDetailed || isNotCollected
              })(),
            })
            return accum
          }
          const existingQuestionContainer = accum.find(
            e => e.multiselectId === multiselectId,
          )
          if (!existingQuestionContainer) {
            accum.push({
              ...curr,
              multiselectId,
              multiselectValues: [{ name: curr.name, value: mappedValue }],
              // we don't have any required multiselects so we can simply hide them
              // all in basic mode
              isDetailedMode: true,
            })
            return accum
          }
          const trimTrailingStuffRegex = /[^\w]*$/
          const trimLeadingStuffRegex = /^[^\w]*/
          existingQuestionContainer.name = findCommonString(
            curr.name,
            existingQuestionContainer.name,
          ).replace(trimTrailingStuffRegex, '')
          ;(function fixUpFirstValue() {
            const firstValue = existingQuestionContainer.multiselectValues[0]
            firstValue.name = firstValue.name
              .replace(existingQuestionContainer.name, '')
              .replace(trimLeadingStuffRegex, '')
          })()
          const thisMultiselectValueName = curr.name
            .replace(existingQuestionContainer.name, '')
            .replace(trimLeadingStuffRegex, '')
          existingQuestionContainer.multiselectValues.push({
            name: thisMultiselectValueName,
            value: mappedValue,
          })
          return accum
        }, [])
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
      return (this.nullSafeObs.photos || []).map((e, index) => ({
        // while photos are still processing, they all have the same URL so
        // we'll make a unique ID
        id: 'photo-' + index,
        url: e.url.replace('square', 'medium'),
      }))
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
    isNoIdsOrComments() {
      return !(this.nullSafeObs.idsAndComments || []).length
    },
    obsOnInatUrl() {
      return `${inatUrlBase}/observations/${this.nullSafeObs.inatId}`
    },
  },
  watch: {
    '$route.params.id'(val) {
      // should be able to use beforeRouteUpdate() instead, but couldn't get it to work
      this.$store.commit('obs/setSelectedObservationId', val)
    },
    observationDetail(newVal, oldVal) {
      if (newVal) {
        // only act when it was deleted
        return
      }
      const uuid = oldVal.uuid
      this.navigateToNewDetailPage(uuid)
    },
  },
  async created() {
    this.obsFieldSorterFn = await this.$store.dispatch(
      'obs/buildObsFieldSorter',
    )
    this.debouncedResetProcessingOutcome = _.debounce(
      this._resetProcessingOutcome,
      2000,
      { leading: true, trailing: false },
    )
    // TODO enhancement idea: when landing from gallery, could preselect the
    // referrer photo.
  },
  methods: {
    async navigateToNewDetailPage(uuid) {
      // the record to be deleted doesn't have the iNat ID and we don't have
      // access to the new record that will replace it so we need to look up the
      // ID
      this.$wow.uiTrace('ObsDetail', `jump to new detail page post-upload`)
      try {
        const inatId = await this.$store.dispatch(
          'obs/findObsInatIdForUuid',
          uuid,
        )
        this.$router.replace({
          name: 'ObsDetail',
          params: { id: inatId },
        })
      } catch (err) {
        wowErrorHandler(
          `Failed to look up iNatID from a UUID where the local record was ` +
            `deleted out from underneath us`,
          err,
        )
        // we can't leave the user on this page, there's nothing there.
        this.$router.replace({
          name: 'Home',
        })
      }
    },
    resetProcessingOutcomeFromSystemError() {
      this.$wow.uiTrace('ObsDetail', `reset an obs from system error`)
      this.debouncedResetProcessingOutcome(
        'Failed to reset processing outcome after error',
      )
    },
    resetProcessingOutcomeFromStuck() {
      this.$wow.uiTrace('ObsDetail', `reset an obs from stuck`)
      this.debouncedResetProcessingOutcome(
        'Failed to reset processing outcome from a possibly stuck record',
      )
    },
    _resetProcessingOutcome(errMsg) {
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
              msg: errMsg,
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
    onMainActionMenu() {
      const menu = {
        Delete: () => {
          this.$wow.uiTrace('ObsDetail', `delete observation`)
          this.$ons.notification
            .confirm('Are you sure about deleting this record?')
            .then(answer => {
              if (!answer) {
                this.$wow.uiTrace('ObsDetail', `abort delete observation`)
                return
              }
              this.$wow.uiTrace('ObsDetail', `confirm delete observation`)
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
          this.$wow.uiTrace('ObsDetail', `delete local edit observation`)
          this.$ons.notification
            .confirm(
              'This record has an edit that has NOT yet been ' +
                'synchronised to the server. Do you want to delete only the local ' +
                'changes so the record on the server stays unchanged?',
            )
            .then(answer => {
              if (!answer) {
                this.$wow.uiTrace(
                  'ObsDetail',
                  `abort delete local edit observation`,
                )
                return
              }
              this.$wow.uiTrace(
                'ObsDetail',
                `confirm delete local edit observation`,
              )
              this.$store
                .dispatch('obs/deleteSelectedLocalRecord')
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
    onCommentActionMenu(commentRecord) {
      const menu = {
        Delete: () => {
          this.$ons.notification
            .confirm('Are you sure about deleting this comment?')
            .then(answer => {
              if (!answer) {
                return
              }
              this.$store
                .dispatch('obs/deleteComment', {
                  obsId: this.selectedObsInatId,
                  commentRecord,
                })
                .then(() => {
                  this.$ons.notification.toast('Comment deleted!', {
                    timeout: 3000,
                    animation: 'fall',
                  })
                })
                .catch(err => {
                  this.handleMenuError(err, {
                    msg: 'Failed to delete comment',
                    userMsg: 'Error while deleting comment.',
                  })
                })
            })
        },
        Edit: () => {
          this.isShowCommentEditModal = true
          this.editCommentRecord = commentRecord
        },
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
      this.$wow.uiTrace('ObsDetail', `edit observation`)
      const obsId = wowIdOf(this.nullSafeObs)
      this.$router.push({ name: 'ObsEdit', params: { id: obsId } })
    },
    showPhotoPreview(url) {
      this.$store.commit('ephemeral/previewPhoto', {
        url: url.indexOf('medium') > 0 ? url.replace('medium', 'large') : url,
      })
    },
    dateInfo(item) {
      return humanDateString(item)
    },
    identificationPhotoUrl(identification) {
      return identification.taxonPhotoUrl || noImagePlaceholderUrl
    },
    async onNewComment() {
      this.$wow.uiTrace('ObsDetail', `create new comment`)
      try {
        this.isSavingComment = true
        await this.$store.dispatch('obs/createComment', {
          obsId: this.selectedObsInatId,
          commentBody: this.newCommentBody,
        })
        this.newCommentBody = null
        this.$ons.notification.toast('Comment created', {
          timeout: 3000,
          animation: 'fall',
        })
      } catch (err) {
        this.$store.dispatch(
          'flagGlobalError',
          {
            msg: `Failed while POSTing new comment to the server`,
            userMsg: 'Failed to create a new comment',
            err,
          },
          { root: true },
        )
      } finally {
        this.isSavingComment = false
      }
    },
    async onSaveEditComment() {
      this.$wow.uiTrace('ObsDetail', `save comment edit`)
      try {
        this.isSavingComment = true
        await this.$store.dispatch('obs/editComment', {
          obsId: this.selectedObsInatId,
          commentRecord: this.editCommentRecord,
        })
      } catch (err) {
        this.$store.dispatch(
          'flagGlobalError',
          {
            msg: `Failed while PUTing edited comment to the server`,
            userMsg: 'Failed to edit comment',
            err,
          },
          { root: true },
        )
        return
      } finally {
        this.isSavingComment = false
        this.isShowCommentEditModal = false
      }
      this.editCommentRecord = {}
      this.$ons.notification.toast('Comment edited', {
        timeout: 3000,
        animation: 'fall',
      })
    },
    onCancelEditComment() {
      this.$wow.uiTrace('ObsDetail', `cancel comment edit`)
      this.isShowCommentEditModal = false
      this.editCommentRecord = {}
    },
  },
}
</script>

<style scoped lang="scss">
@import '@/theme/variables.scss';

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

.warn-card {
  background-color: #ffe291;
}

.wow-subtitle {
  color: #666;
}

.inat-details {
  color: #888;
  margin-top: 1em;
}

.yes {
  color: green;
}

.no {
  color: red;
}

.const-ms-width {
  flex: 0 0 1em;
}

.interaction-header {
  text-transform: none;

  .category {
    float: right;
    text-transform: capitalize;
    margin-right: 1em;
  }
}

.identification-comment {
  order: 1;
  white-space: pre-line;
}

.wow-identification-title {
  font-size: 1.4em;
}

.withdrawn {
  text-decoration: line-through;
}

.wow-textarea {
  padding: 12px 16px 14px;
  border-radius: 4px;
  width: 100%;
  height: 5em;
}

.edit-textarea {
  width: auto;
}

.comment-button-container {
  flex-grow: 1;
  margin-top: 1em;
}

.new-comment-container {
  margin-top: 2em;
}

.edit-modal {
  /* FIXME how do we get this modal to be wider with a proportioned textarea? */
}
</style>
