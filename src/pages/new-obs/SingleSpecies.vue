<template>
  <v-ons-page>
    <custom-toolbar cancellable :title="title">
      <template v-slot:right>
        <v-ons-toolbar-button @click="onSave">Save</v-ons-toolbar-button>
      </template>
    </custom-toolbar>
    <v-ons-list-item modifier="nodivider">
      Provide responses for at least all the required questions, then press the
      save button.
    </v-ons-list-item>
    <v-ons-list>
      <v-ons-list-item v-show="geolocationErrorMsg" modifier="nodivider">
        <div class="warning-alert">
          <p>
            <v-ons-icon
              class="warning"
              icon="fa-exclamation-circle"
            ></v-ons-icon>
            {{ geolocationErrorMsg }}. This observation cannot be created
            without geolocation details.
          </p>
        </div>
      </v-ons-list-item>
      <v-ons-list-item v-if="isShowGeolocationSection">
        <div v-show="isLocationAlreadyCaptured">
          <div class="success-alert">
            <v-ons-icon icon="fa-map-marked-alt" />
            Geolocation successfully captured from
            {{ obsLocSourceName }}.
            <div>
              <v-ons-button modifier="quiet" @click="toggleMap">
                <span v-if="!isShowMap">View location on </span>
                <span v-if="isShowMap">Hide </span>map</v-ons-button
              >
            </div>
          </div>
          <google-map
            v-if="isShowMap"
            :marker-position="obsCoords"
            style="width: 94vw;"
          />
        </div>
        <div v-show="!isLocationAlreadyCaptured" class="warning-alert">
          <v-ons-icon icon="fa-exclamation-circle" />
          No geolocation captured. Attach a photo tagged with GPS coordinates or
          <v-ons-button modifier="quiet" @click="getDeviceGpsLocation"
            >use current device location</v-ons-button
          >
        </div>
      </v-ons-list-item>
      <template v-for="currMenuItem of photoMenu">
        <wow-header
          :key="currMenuItem.name + '-header'"
          :label="currMenuItem.name + ' photos'"
          :required="currMenuItem.required"
          help-target="photos"
          class="margin-for-photos"
          @on-help="showHelp"
        />
        <div :key="currMenuItem.name + '-photos'" class="photo-container">
          <div class="photo-item">
            <div class="text-left button-container">
              <input
                :id="currMenuItem.id + '-add'"
                :ref="photoRef(currMenuItem)"
                type="file"
                :name="currMenuItem.id + '-add'"
                accept="image/png, image/jpeg"
                class="photo-button"
                @change="onPhotoChanged(currMenuItem)"
              />
            </div>
            <label :for="currMenuItem.id + '-add'">
              <v-ons-icon class="the-icon" icon="md-image-o"></v-ons-icon>
              <div class="photo-label-text">Add</div>
            </label>
          </div>
          <div
            v-for="currPhoto of allPhotosByType[currMenuItem.id]"
            :key="currPhoto.uuid"
            class="photo-item"
          >
            <div
              :style="{ 'background-image': `url('${currPhoto.url}')` }"
              class="wow-thumbnail"
              @click="showPhotoPreview(currPhoto)"
            ></div>
          </div>
        </div>
      </template>
      <template v-if="allPhotosByType[otherType]">
        <wow-header label="Other photos" class="margin-for-photos" />
        <div class="photo-container">
          <div
            v-for="currPhoto of allPhotosByType[otherType]"
            :key="currPhoto.uuid"
            class="photo-item"
          >
            <img
              :src="currPhoto.url"
              class="wow-thumbnail"
              @click="showPhotoPreview(currPhoto)"
            />
          </div>
        </div>
      </template>
      <wow-header
        label="Species name or your descriptive field name"
        help-target="field-name"
        class="margin-for-photos"
        @on-help="showHelp"
      />
      <v-ons-list-item modifier="nodivider">
        <wow-autocomplete
          :items="speciesGuessAutocompleteItems"
          :initial-value="speciesGuessInitialValue"
          placeholder-text="e.g. snail orchid"
          @change="debouncedOnSpeciesGuessInput"
          @item-selected="onSpeciesGuessSet"
        />
        <div class="wow-obs-field-desc">
          <wow-required-chip />
          What species is this observation of?
        </div>
      </v-ons-list-item>
      <template v-for="currField of displayableObsFields">
        <wow-header
          :key="currField.id + '-list'"
          :label="currField.name"
          :help-target="currField.id"
          @on-help="showHelp"
        />
        <v-ons-list-item
          :key="currField.id + '-obs-field'"
          modifier="nodivider"
          :data-debug-field-id="currField.id"
        >
          <div
            class="wow-obs-field-input-container input-status-wrapper"
            :class="{
              'multiselect-container':
                currField.wowDatatype === multiselectFieldType,
            }"
          >
            <v-ons-select
              v-if="currField.wowDatatype === selectFieldType"
              v-model="obsFieldValues[currField.id]"
              class="wow-select"
            >
              <option v-if="currField.required" :value="null" disabled>
                please select
              </option>
              <option
                v-for="(currOption, $index) in currField.allowedValues"
                :key="currField.id + '-' + $index"
                :value="currOption.value"
              >
                {{ currOption.title }}
              </option>
            </v-ons-select>
            <v-ons-input
              v-else-if="currField.wowDatatype === numericFieldType"
              v-model="obsFieldValues[currField.id]"
              float
              placeholder="Input value"
              type="number"
              @change="onNumberChange($event, currField.id)"
            >
            </v-ons-input>
            <textarea
              v-else-if="currField.wowDatatype === 'text'"
              v-model="obsFieldValues[currField.id]"
              placeholder="Input value"
              class="wow-textarea"
            >
            </textarea>
            <wow-autocomplete
              v-else-if="currField.wowDatatype === taxonFieldType"
              :items="taxonQuestionAutocompleteItems[currField.id]"
              :initial-value="obsFieldInitialValues[currField.id]"
              placeholder-text="e.g. snail orchid"
              :extra-callback-data="currField.id"
              @change="debouncedOnTaxonQuestionInput"
              @item-selected="onTaxonQuestionSet"
            />
            <template
              v-else-if="currField.wowDatatype === multiselectFieldType"
            >
              <div
                v-for="currVal of currField.multiselectValues"
                :key="currVal.id"
                class="multiselect-value"
              >
                <v-ons-switch
                  v-model="obsFieldValues[currVal.id]"
                  :input-id="currField.id + '-' + currVal.id"
                  :disabled="fieldIdIsDisabled[currVal.id]"
                  @change="onMultiselectChange(currField, currVal, $event)"
                />
                <label
                  :for="currField.id + '-' + currVal.id"
                  class="multiselect-question"
                  >{{ currVal.label }}
                </label>
              </div>
            </template>
            <div v-else style="color: red;">
              PROGRAMMER, you have work to do - support '{{
                currField.wowDatatype
              }}' field type
            </div>
            <wow-input-status
              v-if="isShowInputStatus(currField)"
              :is-ok="!!obsFieldValues[currField.id]"
              class="the-input-status"
            ></wow-input-status>
          </div>
          <div class="wow-obs-field-desc">
            <wow-required-chip v-if="currField.required" />
            {{ currField.description }}
          </div>
        </v-ons-list-item>
      </template>
      <wow-header label="Notes" />
      <v-ons-list-item>
        <textarea
          v-model="notes"
          placeholder="anything else noteworthy"
          class="wow-textarea"
        >
        </textarea>
        <div class="wow-obs-field-desc">
          For personal notes only. None of this information will be read by
          orchid researchers, and data will not be transferred from this field
          into the other fields.
        </div>
      </v-ons-list-item>
    </v-ons-list>
    <div class="footer-whitespace"></div>
    <v-ons-dialog cancelable :visible.sync="formErrorDialogVisible">
      <div class="form-error-dialogue">
        <h3>Invalid value(s)</h3>
        <p>Please correct the invalid values and try again.</p>
        <ul class="error-msg-list">
          <li v-for="curr of formErrorMsgs" :key="curr">{{ curr }}</li>
        </ul>
      </div>
      <v-ons-alert-dialog-button @click="onDismissFormError"
        >Ok</v-ons-alert-dialog-button
      >
    </v-ons-dialog>
    <v-ons-modal :visible="isSaveModalVisible">
      <p class="text-center">
        Saving <v-ons-icon icon="fa-spinner" spin></v-ons-icon>
      </p>
      <p v-show="isShowModalForceClose" class="text-center">
        Hmmm, this is taking a while. It's best to wait for saving to finish,
        but if you're sure something has gone wrong, you can
        <v-ons-button @click="isSaveModalVisible = false"
          >force close this notification</v-ons-button
        >
      </p>
    </v-ons-modal>
    <v-ons-modal :visible="isHelpModalVisible" @postshow="helpModelPostShow">
      <wow-help ref="wowHelp" @close="closeHelpModal" />
    </v-ons-modal>
    <wow-photo-preview :show-delete="true" @on-delete="onDeletePhoto" />
  </v-ons-page>
</template>

<script>
import uuid from 'uuid/v1'
import { mapState, mapGetters } from 'vuex'
import _ from 'lodash'
import {
  findCommonString,
  rectangleAlongPathAreaValueToTitle,
  wowErrorHandler,
  wowWarnHandler,
} from '@/misc/helpers'
import {
  accuracyOfSearchAreaCalcObsFieldId,
  approxAreaSearchedObsFieldId,
  areaOfPopulationObsFieldId,
  blocked,
  coarseFragmentsMultiselectId,
  conservationImmediateLanduseObsFieldId,
  countOfIndividualsObsFieldDefault,
  countOfIndividualsObsFieldId,
  epiphyteHeightObsFieldId,
  failed,
  getMultiselectId,
  hostTreeSpeciesObsFieldId,
  mutuallyExclusiveMultiselectObsFieldIds,
  noValue,
  notCollected,
  notSupported,
  orchidTypeEpiphyte,
  orchidTypeObsFieldId,
  orchidTypeTerrestrial,
  searchAreaCalcPreciseLengthObsFieldId,
  searchAreaCalcPreciseWidthObsFieldId,
  soilStructureObsFieldId,
  widerLanduseObsFieldId,
  yesValue,
  accuracyOfSearchAreaCalcEstimated,
  accuracyOfSearchAreaCalcPrecise,
} from '@/misc/constants'

const speciesGuessRecentTaxaKey = 'speciesGuess'
const taxonFieldType = 'taxon'
const numericFieldType = 'numeric'
const selectFieldType = 'select'
const multiselectFieldType = 'multiselect'

export default {
  name: 'SingleSpecies',
  data() {
    return {
      photoMenu: [
        { id: 'whole-plant', name: 'Whole plant', required: true },
        { id: 'flower', name: 'Flower' },
        { id: 'leaf', name: 'Leaf' },
        { id: 'fruit', name: 'Fruit' },
        { id: 'habitat', name: 'Habitat', required: true },
        { id: 'micro-habitat', name: 'Micro-habitat', required: true },
        { id: 'canopy', name: 'Canopy' },
        { id: 'floral-visitors', name: 'Floral visitors' },
        { id: 'host-tree', name: 'Epiphyte host tree' },
      ],
      speciesGuessInitialValue: null,
      speciesGuessSelectedItem: null,
      speciesGuessValue: null,
      photos: [],
      uploadedPhotos: [],
      obsFieldValues: {},
      obsFieldInitialValues: {}, // for comparing after edit
      obsFieldVisibility: {},
      notes: null,
      photoIdsToDelete: [],
      speciesGuessAutocompleteItems: [],
      taxonQuestionAutocompleteItems: {},
      taxonFieldType,
      numericFieldType,
      selectFieldType,
      multiselectFieldType,
      formErrorDialogVisible: false,
      formErrorMsgs: [],
      existingRecordSnapshot: null,
      targetHelpSection: null,
      isSaveModalVisible: false,
      isShowModalForceClose: false,
      geolocationErrorMsg: null,
      obsFieldSorterFn: null,
      isPreciseSearchAreaCalc: false,
      isEstimatedSearchAreaCalc: false,
      isPopulationRecord: false,
      requiredFieldIdsConditionalOnNumberFields: [],
      requiredFieldIdsConditionalAccuracyOfSearchField: [],
      otherType: 'other',
      fieldIdIsDisabled: {},
      photosStillCompressingCountdownLatch: 0,
      obsLat: null,
      obsLng: null,
      obsLocAccuracy: null,
      obsLocSourceName: null,
      isShowMap: false,
    }
  },
  computed: {
    ...mapGetters('obs', ['observationDetail', 'obsFields']),
    ...mapState('ephemeral', ['networkOnLine', 'isHelpModalVisible']),
    displayableObsFields() {
      const clonedObsFields = this.obsFields.slice(0)
      const result = clonedObsFields.reduce((accum, curr) => {
        if (!this.obsFieldVisibility[curr.id]) {
          return accum
        }
        const multiselectId = getMultiselectId(curr.id)
        const isMultiselect = !!multiselectId
        const wowDatatype = (() => {
          if (isMultiselect) {
            return multiselectFieldType
          }
          const hasAllowedValues = (curr.allowedValues || []).length
          if (hasAllowedValues) {
            return selectFieldType
          }
          return curr.datatype
        })()
        if (isMultiselect) {
          const existingQuestionContainer = accum.find(
            e => e.id === multiselectId,
          )
          if (existingQuestionContainer) {
            const trimTrailingStuffRegex = /[^\w]*$/
            const trimLeadingStuffRegex = /^[^\w]*/
            existingQuestionContainer.name = findCommonString(
              curr.name,
              existingQuestionContainer.name,
            ).replace(trimTrailingStuffRegex, '')
            ;(function fixUpFirstValue() {
              const firstValue = existingQuestionContainer.multiselectValues[0]
              firstValue.label = firstValue.label
                .replace(existingQuestionContainer.name, '')
                .replace(trimLeadingStuffRegex, '')
            })()
            const thisMultiselectValueName = curr.name
              .replace(existingQuestionContainer.name, '')
              .replace(trimLeadingStuffRegex, '')
            existingQuestionContainer.multiselectValues.push({
              id: curr.id,
              label: thisMultiselectValueName,
            })
            return accum
          }
          accum.push({
            id: multiselectId,
            description: curr.description,
            position: curr.position,
            name: curr.name,
            wowDatatype,
            multiselectValues: [{ id: curr.id, label: curr.name }],
          })
          return accum
        }
        const isConditionalRequiredField = [
          ...this.requiredFieldIdsConditionalOnNumberFields,
          ...this.requiredFieldIdsConditionalAccuracyOfSearchField,
          epiphyteHeightObsFieldId,
          hostTreeSpeciesObsFieldId,
          widerLanduseObsFieldId,
        ].includes(curr.id)
        const field = {
          ...curr,
          required: isConditionalRequiredField || curr.required,
          wowDatatype,
        }
        if (field.wowDatatype === selectFieldType) {
          const strategy = getAllowedValsStrategy(field)
          field.allowedValues = strategy(curr.allowedValues)
        }
        accum.push(field)
        return accum
      }, [])
      const targetField = 'id'
      if (this.obsFieldSorterFn) {
        // no error on initial run, the real sorter will be used though
        this.obsFieldSorterFn(result, targetField)
      }
      return result
    },
    taxonQuestionIds() {
      return this.displayableObsFields
        .filter(f => f.wowDatatype === taxonFieldType)
        .map(e => e.id)
    },
    isEdit() {
      return this.$route.matched.some(record => record.meta.isEdit)
    },
    title() {
      return this.isEdit ? 'Edit observation' : 'New observation'
    },
    allPhotosByType() {
      const allPhotos = [...this.uploadedPhotos, ...this.photos]
      return allPhotos.reduce((accum, curr) => {
        const type = this.computeType(curr).id || this.otherType
        const photoCollection = accum[type] || []
        photoCollection.push(curr)
        accum[type] = photoCollection
        return accum
      }, {})
    },
    isLocationAlreadyCaptured() {
      if (
        this.observationDetail &&
        this.observationDetail.lat &&
        this.observationDetail.lng
      ) {
        return true
      }
      return !!(this.obsLat && this.obsLng)
    },
    obsCoords() {
      return { lat: this.obsLat, lng: this.obsLng }
    },
    isShowGeolocationSection() {
      if (this.isEdit) {
        return false
      }
      if (this.photos.length > 1) {
        return true
      }
      if (this.photos.length === 1) {
        return !this.photosStillCompressingCountdownLatch
      }
      return false
    },
  },
  watch: {
    [`obsFieldValues.${orchidTypeObsFieldId}`](newVal) {
      const isEpiphyte = newVal === orchidTypeEpiphyte
      this.obsFieldVisibility[hostTreeSpeciesObsFieldId] = isEpiphyte
      this.obsFieldVisibility[epiphyteHeightObsFieldId] = isEpiphyte
      const isTerrestrial = newVal === orchidTypeTerrestrial
      this.obsFieldVisibility[soilStructureObsFieldId] = isTerrestrial
      this.obsFieldVisibility[coarseFragmentsMultiselectId] = isTerrestrial
    },
    [`obsFieldValues.${conservationImmediateLanduseObsFieldId}`](newVal) {
      const isConservation = newVal === true
      this.obsFieldVisibility[widerLanduseObsFieldId] = isConservation
    },
    [`obsFieldValues.${accuracyOfSearchAreaCalcObsFieldId}`](newVal) {
      this.requiredFieldIdsConditionalAccuracyOfSearchField = []
      this.isPreciseSearchAreaCalc = newVal === accuracyOfSearchAreaCalcPrecise
      if (this.isPreciseSearchAreaCalc) {
        this.requiredFieldIdsConditionalAccuracyOfSearchField.push(
          searchAreaCalcPreciseWidthObsFieldId,
          searchAreaCalcPreciseLengthObsFieldId,
        )
      }
      this.isEstimatedSearchAreaCalc =
        newVal === accuracyOfSearchAreaCalcEstimated
      this.refreshVisibilityOfSearchAreaFields()
    },
  },
  beforeMount() {
    this.$store.commit('ephemeral/enableWarnOnLeaveRoute')
    // we cannot use this.taxonQuestionIds here as it's not bound at this stage
    this.taxonQuestionAutocompleteItems = this.obsFields
      .filter(f => f.datatype === taxonFieldType)
      .reduce((accum, curr) => {
        // prepopulate keys of taxonQuestionAutocompleteItems so they're watched by Vue
        accum[curr.id] = null
        return accum
      }, {})
    const obsFieldsPromise = this.$store.dispatch('obs/waitForProjectInfo')
    if (this.isEdit) {
      this.initForEdit(obsFieldsPromise)
      this.snapshotExistingRecord()
    } else {
      this.initForNew(obsFieldsPromise)
    }
    this.setRecentlyUsedTaxa()
  },
  async created() {
    this.debouncedOnSpeciesGuessInput = _.debounce(
      this._onSpeciesGuessInput,
      300,
    )
    this.debouncedOnTaxonQuestionInput = _.debounce(
      this._onTaxonQuestionInput,
      300,
    )
    this.obsFieldSorterFn = await this.$store.dispatch(
      'obs/buildObsFieldSorter',
    )
  },
  methods: {
    initForNew(obsFieldsPromise) {
      obsFieldsPromise.then(() => {
        this.setDefaultObsFieldVisibility()
        this.setDefaultAnswers()
        this.setDefaultDisabledness()
        this.refreshVisibilityOfPopulationRecordFields()
      })
      this.geolocationErrorMsg = null
    },
    initForEdit(obsFieldsPromise) {
      obsFieldsPromise.then(() => {
        this.setDefaultObsFieldVisibility()
        this.setDefaultAnswers()
        this.setDefaultDisabledness()
        this.refreshVisibilityOfPopulationRecordFields()
        // pre-populate obs fields
        const answersFromSaved = this.observationDetail.obsFieldValues.reduce(
          (accum, curr) => {
            const isMultiselect = !!getMultiselectId(curr.fieldId)
            let value = curr.value
            if (isMultiselect) {
              value = (() => {
                if (value === yesValue) {
                  return true
                }
                if (value === noValue) {
                  return false
                }
                throw new Error(
                  `Unhandled value='${value}' when mapping from remote ` +
                    'obs field value to local multiselect value',
                )
              })()
            }
            accum[curr.fieldId] = value
            return accum
          },
          {},
        )
        this.obsFieldValues = {
          ...this.obsFieldValues, // these will be the defaults
          ...answersFromSaved,
        }
        this.obsFieldInitialValues = _.cloneDeep(answersFromSaved)
        // fire change handler for all multiselects to set the UI up as expected
        for (const currMultiselect of this.displayableObsFields.filter(
          e => e.wowDatatype === multiselectFieldType,
        )) {
          for (const currItem of currMultiselect.multiselectValues) {
            // TODO possible enhancement: check for impossible situation due to
            // edits done outside the app
            this.onMultiselectChange(currMultiselect, currItem, {
              value: this.obsFieldValues[currItem.id],
            })
          }
        }
      })
      if (this.observationDetail.speciesGuess) {
        const val = this.observationDetail.speciesGuess
        this.speciesGuessInitialValue = val
        this.speciesGuessValue = val
      }
      if (this.observationDetail.notes) {
        this.notes = this.observationDetail.notes
      }
      // pre-populate photos
      this.uploadedPhotos = this.observationDetail.photos
    },
    onNumberChange(event, fieldId) {
      // we should be able to use the Vue "watch" to achieve this but I
      // couldn't get it to work on number fields (the watcher never gets
      // fired) hence this hack. If you get the watcher working, delete
      // this mess.
      this.requiredFieldIdsConditionalOnNumberFields = []
      const newVal = event.target.value
      switch (fieldId) {
        case countOfIndividualsObsFieldId:
          this.isPopulationRecord = parseInt(newVal) > 1
          this.obsFieldValues[areaOfPopulationObsFieldId] = null
          if (this.isPopulationRecord) {
            this.requiredFieldIdsConditionalOnNumberFields.push(
              approxAreaSearchedObsFieldId,
            )
            this.requiredFieldIdsConditionalOnNumberFields.push(
              accuracyOfSearchAreaCalcObsFieldId,
            )
            this.requiredFieldIdsConditionalOnNumberFields.push(
              areaOfPopulationObsFieldId,
            )
            this.handleObsFieldOptionalToRequired(approxAreaSearchedObsFieldId)
            this.handleObsFieldOptionalToRequired(
              accuracyOfSearchAreaCalcObsFieldId,
            )
          } else {
            // individual record
            this.handleObsFieldRequiredToOptional(approxAreaSearchedObsFieldId)
            this.handleObsFieldRequiredToOptional(
              accuracyOfSearchAreaCalcObsFieldId,
            )
          }
          this.refreshVisibilityOfPopulationRecordFields()
          this.refreshVisibilityOfSearchAreaFields()
          break
      }
    },
    handleObsFieldOptionalToRequired(obsFieldId) {
      const isSetToNotCollected =
        this.obsFieldValues[obsFieldId] === notCollected
      if (!isSetToNotCollected) {
        return
      }
      this.obsFieldValues[obsFieldId] = null
    },
    handleObsFieldRequiredToOptional(obsFieldId) {
      const isSetToNull = this.obsFieldValues[obsFieldId] === null
      if (!isSetToNull) {
        return
      }
      this.obsFieldValues[obsFieldId] = notCollected
    },
    refreshVisibilityOfPopulationRecordFields() {
      this.obsFieldVisibility[
        areaOfPopulationObsFieldId
      ] = this.isPopulationRecord
    },
    refreshVisibilityOfSearchAreaFields() {
      this.obsFieldVisibility[
        searchAreaCalcPreciseWidthObsFieldId
      ] = this.isPreciseSearchAreaCalc
      this.obsFieldVisibility[
        searchAreaCalcPreciseLengthObsFieldId
      ] = this.isPreciseSearchAreaCalc
      this.obsFieldVisibility[
        approxAreaSearchedObsFieldId
      ] = this.isEstimatedSearchAreaCalc
    },
    showHelp(section) {
      this.$store.commit('ephemeral/showHelpModal')
      this.targetHelpSection = section
    },
    helpModelPostShow() {
      this.$refs.wowHelp.scrollToSection(this.targetHelpSection)
    },
    closeHelpModal() {
      this.$store.commit('ephemeral/hideHelpModal')
    },
    isShowInputStatus(field) {
      return field.required && field.wowDatatype !== taxonFieldType
    },
    setRecentlyUsedTaxa() {
      this.speciesGuessAutocompleteItems =
        this.$store.state.obs.recentlyUsedTaxa[speciesGuessRecentTaxaKey] || []
      for (const currId of this.taxonQuestionIds) {
        this.taxonQuestionAutocompleteItems[currId] =
          this.$store.state.obs.recentlyUsedTaxa[currId] || []
      }
    },
    setDefaultObsFieldVisibility() {
      // TODO currently the multiselect questions are missing from the
      // visibility list. It's not a problem until we need to hide at least
      // one of them
      this.obsFieldVisibility = this.obsFields.reduce((accum, curr) => {
        accum[curr.id] = true
        return accum
      }, {})
    },
    onSpeciesGuessSet(data) {
      // We need to store both directly, as opposed to computing one from the
      // other, because we need to be able to set the text value directly when in
      // edit mode. And we need the full object to store for recently used taxa.
      this.speciesGuessSelectedItem = data.value
      this.speciesGuessValue = (
        this.speciesGuessSelectedItem || {}
      ).preferredCommonName
    },
    onTaxonQuestionSet(data) {
      const fieldId = data.extra
      this.obsFieldValues[fieldId] = data.value
    },
    onDeletePhoto(record) {
      const isLocalFromPreviousEdit = !!record.id
      if (record.isRemote || isLocalFromPreviousEdit) {
        const id = record.id
        this.photoIdsToDelete.push(id)
        this.uploadedPhotos = this.uploadedPhotos.filter(p => p.id !== id)
        this.closePhotoPreview()
        return
      }
      const indexOfPhoto = this.photos.findIndex(e => e.uuid == record.uuid)
      if (indexOfPhoto < 0) {
        // why can't we find the photo?
        console.warn(`Data problem: could not find photo with
          UUID='${record.uuid}'`)
        this.closePhotoPreview()
        return
      }
      this.photos.splice(indexOfPhoto, 1)
      const isNoLocalPhotos = !this.photos.length
      if (isNoLocalPhotos) {
        console.debug(
          'No local photos after local photo delete, clearing saved coords',
        )
        // TODO enhancement idea: track which photo we used for coords (by
        // UUID) and if it gets deleted, loop through remaining photos to get
        // coords.
        this.obsLat = null
        this.obsLng = null
        this.obsLocAccuracy = null
      }
      this.closePhotoPreview()
    },
    setDefaultDisabledness() {
      for (const curr of Object.keys(this.obsFieldValues)) {
        this.fieldIdIsDisabled[curr] = false
      }
    },
    setDefaultAnswers() {
      try {
        // TODO are these defaults ok? Should we be smarter like picking the
        // last used values? Or should we have a button to "clone previous
        // observation"?
        this.obsFieldValues = this.displayableObsFields.reduce(
          (accum, curr) => {
            const isMultiselect = curr.wowDatatype === multiselectFieldType
            if (isMultiselect) {
              for (const currVal of curr.multiselectValues) {
                accum[currVal.id] = false
              }
              return accum
            }
            const hasSelectOptions = (curr.allowedValues || []).length
            if (!hasSelectOptions) {
              return accum
            }
            accum[curr.id] = curr.required ? null : curr.allowedValues[0].value
            return accum
          },
          {},
        )
        this.setDefaultIfSupplied(
          countOfIndividualsObsFieldId,
          countOfIndividualsObsFieldDefault,
        )
      } catch (err) {
        // FIXME the UI doesn't reflect this error, is it because we're in mounted()?
        this.$store.dispatch(
          'flagGlobalError',
          {
            msg: `Failed to set default answers`,
            err,
          },
          { root: true },
        )
      }
    },
    setDefaultIfSupplied(fieldId, defaultValue) {
      const fieldDef = this.getObsFieldDef(fieldId)
      const allowedValues = fieldDef.allowedValues.map(v => v.value)
      const isValidValue =
        fieldDef.wowDatatype !== selectFieldType ||
        allowedValues.includes(defaultValue)
      if (!isValidValue) {
        throw new Error(
          `Cannot set field ID='${fieldId}' ` +
            `(name='${fieldDef.name}') to value='${defaultValue}' as it's not ` +
            `in the allowedValues=[${allowedValues}]`,
        )
      }
      this.obsFieldValues[fieldId] = defaultValue
    },
    getObsFieldDef(fieldId) {
      const result = this.displayableObsFields.find(
        f => f.id === parseInt(fieldId),
      )
      if (!result) {
        const availableIds = this.displayableObsFields.map(f => f.id).sort()
        throw new Error(
          `Failed to find obs field definition with ` +
            `ID='${fieldId}' (typeof ID param=${typeof fieldId}) from available ` +
            `IDs=[${availableIds}]`,
        )
      }
      return result
    },
    validatePhotos() {
      const requiredPhotoTypes = this.photoMenu.filter(e => e.required)
      requiredPhotoTypes.forEach(curr => {
        const photosOfType = this.allPhotosByType[curr.id]
        const isAtLeastOnePhotoOfType = photosOfType && photosOfType.length
        if (isAtLeastOnePhotoOfType) {
          return
        }
        this.formErrorMsgs.push(
          `You must attach at least one ${curr.name} photo`,
        )
      })
    },
    validateInputs() {
      // TODO Enhancement idea: highlight the fields with error and maybe scroll
      // to the first field
      this.formErrorMsgs = []
      if (!this.speciesGuessValue) {
        this.formErrorMsgs.push(
          'You must identify this observation with a species name',
        )
      }
      if (!this.isLocationAlreadyCaptured) {
        this.formErrorMsgs.push(
          'Observations *must* have geolocation' +
            ' information. Either use your current location or attach a GPS' +
            ' tagged photo. Scroll to the very top of this page for ' +
            'more details.',
        )
      }
      const visibleRequiredObsFields = this.displayableObsFields.filter(
        f => f.required,
      )
      for (const curr of visibleRequiredObsFields) {
        const val = this.obsFieldValues[curr.id]
        if (!_.isEmpty(_.trim(val))) {
          continue
        }
        this.formErrorMsgs.push(
          `The "${curr.name}" field is required but has no value`,
        )
      }
      const visibleNumericObsFields = this.displayableObsFields.filter(
        f => f.datatype === numericFieldType,
      )
      for (const curr of visibleNumericObsFields) {
        const val = this.obsFieldValues[curr.id]
        if (_.isNil(val) || val > 0) {
          continue
        }
        this.formErrorMsgs.push(
          `The "${curr.name}" field cannot be zero or negative`,
        )
      }
      this.validatePhotos()
      if (this.formErrorMsgs.length) {
        this.formErrorDialogVisible = true
        return false
      }
      return true
    },
    async onSave() {
      this.$store.commit('ephemeral/disableWarnOnLeaveRoute')
      const timeoutId = setTimeout(() => {
        this.isShowModalForceClose = true
      }, 30 * 1000)
      try {
        this.isSaveModalVisible = true
        this.isShowModalForceClose = false
        while (this.photosStillCompressingCountdownLatch > 0) {
          await new Promise(resolve => {
            // TODO do we need a sanity check that breaks out after N tests?
            const waitForImageCompressionMs = 333
            setTimeout(() => {
              return resolve()
            }, waitForImageCompressionMs)
          })
        }
        if (!this.validateInputs()) {
          return
        }
        this.$store.commit('obs/addRecentlyUsedTaxa', {
          type: speciesGuessRecentTaxaKey,
          value: this.speciesGuessSelectedItem,
        })
        for (const currId of this.taxonQuestionIds) {
          const val = this.obsFieldValues[currId]
          // if we're in edit mode and the user doesn't touch this question,
          // it'll just be the string value not the selected item
          const hasUserEditedAnswer = typeof val === 'object'
          const paramToPass = hasUserEditedAnswer ? val : null
          this.$store.commit('obs/addRecentlyUsedTaxa', {
            type: currId,
            value: paramToPass,
          })
        }
        const record = {
          addedPhotos: this.photos.map(curr => ({
            type: curr.type,
            file: curr.file,
          })),
          speciesGuess: this.speciesGuessValue,
          obsFieldValues: this.displayableObsFields.reduce(
            (accum, currField) => {
              const isMultiselect =
                currField.wowDatatype === multiselectFieldType
              if (isMultiselect) {
                for (const currSubField of currField.multiselectValues) {
                  const currSubFieldId = currSubField.id
                  const mappedValue = (() => {
                    const v = this.obsFieldValues[currSubFieldId]
                    // here we're fixing up the booleans that come out of switches
                    if (v === true) {
                      return yesValue
                    }
                    if (v === false) {
                      return noValue
                    }
                    throw new Error(
                      `Unhandled value='${v}' (type=${typeof v}) from onsen switch`,
                    )
                  })()
                  accum.push({
                    fieldId: parseInt(currSubFieldId),
                    name: `${currField.name} - ${currSubField.label}`,
                    value: mappedValue,
                    // datatype: // don't need this
                  })
                }
                return accum
              }
              const currFieldId = currField.id
              const obsFieldDef = this.getObsFieldDef(currFieldId)
              let value = this.obsFieldValues[currFieldId]
              if (isDeletedObsFieldValue(value)) {
                return accum
              }
              if (
                obsFieldDef.datatype === taxonFieldType &&
                // in edit mode when the user doesn't change the value, we'll
                // only have the string value, not the full selected item
                typeof value === 'object'
              ) {
                value = value.preferredCommonName
              }
              accum.push({
                fieldId: parseInt(currFieldId),
                name: obsFieldDef.name,
                value: value,
                datatype: obsFieldDef.datatype,
              })
              return accum
            },
            [],
          ),
          description: this.notes,
        }
        if (this.isEdit) {
          const obsFieldIdsToDelete = Object.keys(this.obsFieldValues).reduce(
            (accum, currKey) => {
              // TODO if we ever have conditionally displayable multiselect
              // fields, then this will need updating to support that.
              const isNotVisible = !this.obsFieldVisibility[currKey]
              const value = this.obsFieldValues[currKey]
              const hadValueBeforeEditing = !_.isNil(
                this.obsFieldInitialValues[currKey],
              )
              const isEmpty = isDeletedObsFieldValue(value)
              if (hadValueBeforeEditing && (isNotVisible || isEmpty)) {
                const obsFieldInstance = this.getObsFieldInstance(currKey)
                const isObsFieldStoredOnRemote = obsFieldInstance.relationshipId
                if (isObsFieldStoredOnRemote) {
                  accum.push(obsFieldInstance.relationshipId)
                }
              }
              return accum
            },
            [],
          )
          record.uuid = this.observationDetail.uuid
          await this.$store.dispatch('obs/saveEditAndScheduleUpdate', {
            record,
            photoIdsToDelete: this.photoIdsToDelete,
            obsFieldIdsToDelete,
          })
          toastSavedMsg(this.$ons)
          this.$router.replace({
            name: 'ObsDetail',
            params: { id: this.observationDetail.inatId },
          })
        } else {
          record.lat = this.obsLat
          record.lng = this.obsLng
          record.positional_accuracy = this.obsLocAccuracy
          const newUuid = await this.$store.dispatch(
            'obs/saveNewAndScheduleUpload',
            record,
          )
          toastSavedMsg(this.$ons)
          this.$router.replace({ name: 'ObsDetail', params: { id: newUuid } })
        }
      } catch (err) {
        this.$store.dispatch('flagGlobalError', {
          msg: 'Failed to save observation to local store',
          userMsg: 'Error while trying to save observation',
          err,
        })
      } finally {
        this.isSaveModalVisible = false
        clearTimeout(timeoutId)
      }
      function toastSavedMsg($ons) {
        setTimeout(() => {
          // TODO should this say something about uploading (or not if
          // offline)? We don't want to confuse "saved" with "uploaded to inat"
          $ons.notification.toast('Successfully saved', {
            timeout: 5000,
            animation: 'ascend',
            // TODO add dismiss button
          })
        }, 800)
      }
    },
    getObsFieldInstance(fieldId) {
      const result = this.observationDetail.obsFieldValues.find(
        f => f.fieldId === parseInt(fieldId),
      )
      if (!result) {
        throw new Error(
          `Could not get obs field instance with fieldId='${fieldId}' ` +
            `(type=${typeof fieldId}) from available instances='${JSON.stringify(
              this.observationDetail.obsFieldValues,
            )}'`,
        )
      }
      return result
    },
    async onPhotoChanged(photoDefObj) {
      const type = photoDefObj.id
      const file = this.$refs[this.photoRef(photoDefObj)][0].files[0]
      if (!file) {
        return
      }
      const theUuid = uuid()
      this.photos.push({
        type,
        file,
        url: URL.createObjectURL(file),
        uuid: theUuid,
      })
      this.photosStillCompressingCountdownLatch += 1
      // here we use the full size photo but send it for compression/resizing in
      // the worker (background) so we don't block the UI. Later, during onSave, we
      // ensure all the photo processing is complete.
      this.$store
        .dispatch('obs/compressPhotoIfRequired', file)
        .then(compressionResult => {
          const found = this.photos.find(e => e.uuid === theUuid)
          if (!found) {
            // guess the photo has already been deleted?
            return
          }
          found.file = compressionResult.data
          found.url = URL.createObjectURL(compressionResult.data)
          // TODO find out if this field is ever populated and if so, find the
          // EXIF tag and pull the data
          const locAccuracyFromPhoto = null
          // Note: we don't support editing an obs location. We have logic
          // to set the location during creation but then we don't touch it
          this.handleGpsLocation(
            compressionResult.location.lat,
            compressionResult.location.lng,
            locAccuracyFromPhoto,
            'photo metadata',
          )
        })
        .catch(err => {
          console.warn('Failed to compress an image', err)
        })
        .finally(() => {
          this.photosStillCompressingCountdownLatch -= 1
        })
    },
    handleGpsLocation(lat, lng, accuracy, source) {
      if (this.isLocationAlreadyCaptured) {
        return
      }
      const isLocationPassed = lat && lng
      if (!isLocationPassed) {
        wowWarnHandler(
          `Asked to handle GPS location but ` +
            `did not receieve *both* lat=${lat} and lng=${lng}`,
        )
        return
      }
      this.geolocationErrorMsg = null
      this.obsLat = lat
      this.obsLng = lng
      this.obsLocAccuracy = accuracy
      this.obsLocSourceName = source
    },
    async _onSpeciesGuessInput(data) {
      const result = await this.doSpeciesAutocomplete(data.value)
      this.speciesGuessAutocompleteItems = result
    },
    async _onTaxonQuestionInput(data) {
      const result = await this.doSpeciesAutocomplete(data.value)
      const fieldId = data.extra
      this.taxonQuestionAutocompleteItems[fieldId] = result
    },
    async doSpeciesAutocomplete(q) {
      if (!this.networkOnLine) {
        return
      }
      try {
        const values = await this.$store.dispatch(
          'obs/doSpeciesAutocomplete',
          q,
        )
        return values
      } catch (err) {
        this.$store.dispatch(
          'flagGlobalError',
          {
            msg: `Failed to perform species autocomplete on text='${q}'`,
            err,
          },
          { root: true },
        )
        // at least give the user a chance to use their input as-is
        return []
      }
    },
    photoRef(e) {
      return 'photo-' + e.id
    },
    onDismissFormError() {
      this.formErrorDialogVisible = false
    },
    snapshotExistingRecord() {
      // if the user edits a local record but the record is uploaded (and
      // cleaned up) before the user hits save, we're in trouble. We can recover
      // as long as we have this snapshot though.
      this.existingRecordSnapshot = _.cloneDeep(
        this.$store.getters['obs/observationDetail'],
      )
    },
    computeType(photoRecord) {
      const url = photoRecord.url
      const type = photoRecord.type // will only be present for local photos
      const matchingType = (() => {
        if (type) {
          return this.photoMenu.find(p => p.id === type)
        }
        return this.photoMenu.find(p => url.includes(`/wow-${p.id}`))
      })()
      return matchingType || { name: 'unknown' }
    },
    showPhotoPreview(photoRecord) {
      const url = photoRecord.url
      // TODO enhancement idea: if we aren't online, then don't do the replace
      // on the URL. Just show the small photo rather than a broken image
      // placeholder. Or get the SW to cache the medium URLs so they'll be
      // available when offline
      const previewedPhoto = {
        ...photoRecord,
        url:
          url.indexOf('square') > 0
            ? photoRecord.url.replace('square', 'large')
            : url,
      }
      this.$store.commit('ephemeral/previewPhoto', previewedPhoto)
    },
    closePhotoPreview() {
      this.$store.commit('ephemeral/closePhotoPreview')
    },
    isMutuallyExclusive(field) {
      return mutuallyExclusiveMultiselectObsFieldIds.includes(field.id)
    },
    onMultiselectChange(multiselectGroupField, itemField, $event) {
      const newVal = $event.value
      const siblingFieldIds = multiselectGroupField.multiselectValues
        .map(e => e.id)
        .filter(e => e !== itemField.id)
      if (this.isMutuallyExclusive(itemField)) {
        for (const curr of siblingFieldIds) {
          this.fieldIdIsDisabled[curr] = newVal
        }
        return
      }
      const isAnySiblingTruthy = siblingFieldIds.some(
        e => this.obsFieldValues[e],
      )
      if (isAnySiblingTruthy) {
        return
      }
      const mutuallyExclusiveSiblingIdsToDisable = multiselectGroupField.multiselectValues
        .filter(e => this.isMutuallyExclusive(e))
        .map(e => e.id)
      for (const curr of mutuallyExclusiveSiblingIdsToDisable) {
        this.fieldIdIsDisabled[curr] = newVal
      }
    },
    async getDeviceGpsLocation() {
      // TODO Enhancement idea: only prompt when we know we don't have access.
      // There's no API support for this but perhaps we can store if we've been
      // successful in the past and use that?
      await this.$ons.notification.alert(
        'We are about to get the current location of your device. ' +
          'You may be prompted to allow/block this access. ' +
          'It is important that you ' +
          '*allow* (do not block) this access.',
      )
      try {
        await this.$store.dispatch('obs/markUserGeolocation')
        this.handleGpsLocation(
          this.$store.state.obs.lat,
          this.$store.state.obs.lng,
          this.$store.state.obs.locAccuracy,
          'device',
        )
      } catch (err) {
        console.debug('No geolocation access for us.', err)
        this.geolocationErrorMsg = (function() {
          if (err === notSupported) {
            return 'Geolocation is not supported by your device'
          }
          if (err === blocked) {
            return (
              'You have blocked access to your device' +
              ' geolocation. Google for something like "reset ' +
              'browser geolocation permission" to find out ' +
              'how to unblock'
            )
          }
          if (err === failed) {
            return (
              `Geolocation seems to be supported and not blocked but ` +
              'something went wrong while accessing your position'
            )
          }
          wowErrorHandler(
            'ProgrammerError: geolocation access failed but in a' +
              ' way that we did not plan for, we should handle this. ' +
              `err.code=${err.code}.`,
            err,
          )
          return 'Something went wrong while trying to access your geolocation'
        })()
      }
    },
    toggleMap() {
      this.isShowMap = !this.isShowMap
    },
  },
}

function isDeletedObsFieldValue(value) {
  return (
    _.isNil(value) || (typeof value === 'string' && _.trim(value).length === 0)
  )
}

function getAllowedValsStrategy(field) {
  const excludeNotCollectedForRequiredFilter = v =>
    !field.required || v !== notCollected
  const rectangleAlongPathAreaMapper = vals =>
    vals.filter(excludeNotCollectedForRequiredFilter).map(v => {
      return { value: v, title: rectangleAlongPathAreaValueToTitle(v) }
    })
  const strats = {
    [approxAreaSearchedObsFieldId]: rectangleAlongPathAreaMapper,
    [areaOfPopulationObsFieldId]: rectangleAlongPathAreaMapper,
  }
  const result = strats[field.id]
  const defaultStrat = vals =>
    vals
      .filter(excludeNotCollectedForRequiredFilter)
      .map(v => ({ value: v, title: v }))
  return result || defaultStrat
}
</script>

<style scoped lang="scss">
$thumbnailSize: 75px;

.margin-for-photos {
  margin: 0.5em 0;
}

.photo-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.photo-item {
  height: $thumbnailSize;
  max-width: $thumbnailSize;
  margin: 0.05em;
  text-align: center;
  flex: 0 0 5em;

  .wow-thumbnail {
    height: 100%;
    width: 100%;
    background-size: cover;
    background-position: center;
    border-radius: 15px;
    box-shadow: 3px 3px 4px #888888;
  }

  label {
    display: block;
    height: 100%;
    background-color: #ececec;
  }

  .button-container {
    position: relative; /* needed for 100% width of child to work */

    .photo-button {
      /* This isn't pretty but some versions of Safari don't trigger the input when
      the label is tapped, so we need to make the input also cover the same area as
      the label */
      width: 100%;
      height: $thumbnailSize;
      opacity: 0;
      overflow: hidden;
      position: absolute;
    }
  }
}

.the-icon {
  line-height: 1em;
  font-size: 3em;
  color: #b9b9b9;
}

.photo-label-text {
  color: #111;
  font-weight: normal;
}

.photo-button + label {
  color: #5b5b5b;
}

.photo-button:focus + label,
.photo-button + label:hover {
  color: black;
}

.map-container div {
  width: 94vw;
}

.wow-obs-field-desc {
  color: #888;
  font-size: 0.7em;
  margin-top: 0.5em;
}

.wow-obs-field-input-container {
  width: 100%;
}

.wow-textarea {
  padding: 12px 16px 14px;
  border-radius: 4px;
  width: 80%;
  height: 5em;
}

.less-prominent {
  color: #686868;
}

.photo-title {
  font-weight: bold;
  margin-top: 1em;
}

.required {
  color: red;
}

.footer-whitespace {
  height: 50vh;
}

.error-msg-list {
  text-align: left;
}

.wow-select {
  width: 80%;
}

.the-input-status {
  margin-left: 1em;
}

.success-alert,
.warning-alert {
  padding: 1em;
  margin: 0 auto;
}

.warning-alert {
  border: 1px solid orange;
  border-radius: 10px;
  background: #ffda88;
}

.success-alert {
  border: 1px solid green;
  border-radius: 10px;
  background: #d5ffbf;
}

.form-error-dialogue {
  width: 90vw;
  padding: 1em;

  h3 {
    margin: 0;
  }
}
</style>
