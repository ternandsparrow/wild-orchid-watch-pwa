<template>
  <v-ons-page>
    <custom-toolbar cancellable :title="title" @cancelled="onCancel">
      <template v-slot:right>
        <v-ons-toolbar-button name="toolbar-save-btn" @click="onSave"
          >Save</v-ons-toolbar-button
        >
      </template>
    </custom-toolbar>
    <v-ons-list-item modifier="nodivider">
      Provide responses for at least all the required questions, then press the
      save button.
    </v-ons-list-item>
    <v-ons-list>
      <template v-for="currMenuItem of photoMenu">
        <wow-header
          :key="currMenuItem.name + '-header'"
          :label="currMenuItem.name + ' photos'"
          :required="currMenuItem.required"
          :help-target="'photos-' + currMenuItem.id"
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
            <a
              :style="{ 'background-image': `url('${currPhoto.url}')` }"
              class="wow-thumbnail faux-div"
              @click="showPhotoPreview(currPhoto)"
            >
            </a>
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
        ref="speciesGuessRef"
        label="Species name or your descriptive field name"
        help-target="field-name"
        class="margin-for-photos"
        @on-help="showHelp"
      />
      <v-ons-list-item modifier="nodivider">
        <wow-autocomplete
          :items="speciesGuessAutocompleteItems"
          :initial-value="speciesGuessInitialValue"
          :is-error="speciesAutocompleteErrors['speciesGuess']"
          placeholder-text="e.g. snail orchid"
          @change="debouncedOnSpeciesGuessInput"
          @item-selected="onSpeciesGuessSet"
        />
        <div class="wow-obs-field-desc">
          <wow-required-chip />
          What species is this observation of?
        </div>
      </v-ons-list-item>
      <!-- FIXME need to init geolocation so it can be edited. Should we also store -->
      <!-- the method used (and the thumbnail, etc) or just show that it *is* saved -->
      <!-- and you can edit it if you like (easier).                                -->
      <wow-header
        v-if="!isEdit"
        label="Geolocation / GPS coordinates"
        help-target="geolocation"
        @on-help="showHelp"
      />
      <wow-collect-geolocation
        v-if="!isEdit"
        :photo-count="photos.length"
        :is-extra-emphasis="isValidatedAtLeastOnce"
        @read-coords="rereadCoords"
      />
      <template v-for="currField of displayableObsFields">
        <template v-if="isDetailedUserMode || !currField.isDetailedModeField">
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
              <v-ons-list v-if="currField.isWideSelect">
                <v-ons-list-item
                  v-for="(currOption, $index) in currField.allowedValues"
                  :key="currField.id + '-' + $index"
                  tappable
                >
                  <label class="left">
                    <v-ons-radio
                      v-model="obsFieldValues[currField.id]"
                      :input-id="'radio-' + currField.id + '-' + $index"
                      :value="currOption.value"
                      modifier="material"
                    >
                    </v-ons-radio>
                  </label>
                  <label
                    :for="'radio-' + currField.id + '-' + $index"
                    class="center"
                  >
                    {{ currOption.title }}
                  </label>
                </v-ons-list-item>
              </v-ons-list>

              <v-ons-select
                v-else-if="currField.wowDatatype === selectFieldType"
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
                @keyup.enter="onNumberInput($event)"
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
                :is-error="speciesAutocompleteErrors[currField.id]"
                placeholder-text="e.g. casuarina glauca"
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
                    ><a>{{ currVal.label }}</a>
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
              ></wow-input-status>
            </div>
            <div class="wow-obs-field-desc">
              <wow-required-chip v-if="currField.required" />
              {{ currField.description }}
            </div>
          </v-ons-list-item>
        </template>
      </template>
      <template v-if="isDetailedUserMode">
        <wow-header
          label="Other comments"
          help-target="notes"
          @on-help="showHelp"
        />
        <v-ons-list-item>
          <textarea
            v-model="notes"
            placeholder="anything else noteworthy"
            class="wow-textarea"
          >
          </textarea>
          <div class="wow-obs-field-desc">
            This is for personal notes only; this information will not be
            included in final data set and data will not be transferred from
            this field into the other fields.
          </div>
        </v-ons-list-item>
      </template>
      <v-ons-list-item>
        <div class="text-center be-wide">
          <v-ons-button name="bottom-save-btn" @click="onSave"
            >Save</v-ons-button
          >
        </div>
      </v-ons-list-item>
      <v-ons-list-item class="detailed-mode-switch-container">
        <label class="center" for="detailedModeSwitch">
          <span class="list-item__title"><a>Enable detailed mode</a></span>
          <span class="list-item__subtitle"
            ><span v-if="!isDetailedUserMode"
              >You are currently in basic mode. You are presented with fewer
              questions than in detailed mode. If you'd like to collect more
              information, use this switch to enable detailed mode which will
              show more questions. All these extra questions are optional and
              you can always switch back if you don't like it.</span
            >
            <span v-if="isDetailedUserMode"
              >You are currently in detailed mode and have the option to collect
              more information. This extra information is <i>optional</i> but if
              you prefer a simpler interface, you can go back to basic
              mode.</span
            >
            This configuration item is also available in the
            <i>Settings</i> menu.
          </span>
        </label>
        <div class="right">
          <v-ons-switch
            v-model="isDetailedUserMode"
            input-id="detailedModeSwitch"
          >
          </v-ons-switch>
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
        Hmmm, this is taking a while. If you have photo compression enabled and
        you're attaching large photo (10s of megapixels), it can take a while to
        compress them. It's best to wait for saving to finish, but if you're
        sure something has gone wrong, you can
        <v-ons-button
          name="force-close-modal-btn"
          @click="isSaveModalVisible = false"
          >force close this notification</v-ons-button
        >
      </p>
    </v-ons-modal>
    <v-ons-modal :visible="isHelpModalVisible" @postshow="helpModalPostShow">
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
  autocompleteTypeHost,
  autocompleteTypeOrchid,
  accuracyOfPopulationCountObsFieldDefault,
  accuracyOfPopulationCountObsFieldId,
  accuracyOfSearchAreaCalcEstimated,
  accuracyOfSearchAreaCalcObsFieldId,
  accuracyOfSearchAreaCalcPrecise,
  approxAreaSearchedObsFieldId,
  areaOfPopulationObsFieldId,
  coarseFragmentsMultiselectId,
  conservationImmediateLanduseObsFieldId,
  countOfIndividualsObsFieldDefault,
  countOfIndividualsObsFieldId,
  epiphyteHeightObsFieldId,
  getMultiselectId,
  hostTreeSpeciesObsFieldId,
  mutuallyExclusiveMultiselectObsFieldIds,
  noValue,
  notCollected,
  photoTypeWholePlant,
  photoTypeFlower,
  photoTypeLeaf,
  photoTypeFruit,
  photoTypeHabitat,
  photoTypeMicrohabitat,
  photoTypeCanopy,
  photoTypeFloralVisitors,
  photoTypeEpiphyteHostTree,
  orchidTypeEpiphyte,
  orchidTypeObsFieldId,
  orchidTypeTerrestrial,
  searchAreaCalcPreciseLengthObsFieldId,
  searchAreaCalcPreciseWidthObsFieldId,
  soilStructureObsFieldId,
  wideSelectObsFieldIds,
  widerLanduseObsFieldId,
  yesValue,
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
        { id: photoTypeWholePlant, name: 'Whole plant', required: true },
        { id: photoTypeFlower, name: 'Flower' },
        { id: photoTypeLeaf, name: 'Leaf' },
        { id: photoTypeFruit, name: 'Fruit' },
        { id: photoTypeHabitat, name: 'Habitat', required: true },
        { id: photoTypeMicrohabitat, name: 'Micro-habitat', required: true },
        { id: photoTypeCanopy, name: 'Canopy' },
        { id: photoTypeFloralVisitors, name: 'Floral visitors' },
        { id: photoTypeEpiphyteHostTree, name: 'Epiphyte host tree' },
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
      obsFieldSorterFn: null,
      isPreciseSearchAreaCalc: false,
      isEstimatedSearchAreaCalc: false,
      isPopulationRecord: false,
      requiredFieldIdsConditionalOnNumberFields: [],
      requiredFieldIdsConditionalAccuracyOfSearchField: [],
      otherType: 'other',
      fieldIdIsDisabled: {},
      speciesAutocompleteErrors: {},
      obsLat: null,
      obsLng: null,
      obsLocAccuracy: null,
      isValidatedAtLeastOnce: false,
      uuidOfThisObs: null,
    }
  },
  computed: {
    ...mapGetters('obs', ['observationDetail', 'obsFields']),
    ...mapState('ephemeral', ['isHelpModalVisible', 'networkOnLine']),
    ...mapGetters('ephemeral', ['photosStillCompressingCount']),
    isDetailedUserMode: {
      get() {
        return this.$store.state.app.isDetailedUserMode
      },
      set(newValue) {
        const newModeName = newValue ? 'detailed' : 'basic'
        this.$wow.uiTrace('SingleSpecies', `switch to ${newModeName} mode`)
        this.$store.commit('app/setIsDetailedUserMode', newValue)
      },
    },
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
            // we don't have any required multiselects so we can simply hide them
            // all in basic mode
            isDetailedModeField: true,
          })
          return accum
        }
        const isConditionalRequiredField = [
          ...this.requiredFieldIdsConditionalOnNumberFields,
          ...this.requiredFieldIdsConditionalAccuracyOfSearchField,
          // if these fields are visible, then they're required!
          epiphyteHeightObsFieldId,
          hostTreeSpeciesObsFieldId,
          widerLanduseObsFieldId,
        ].includes(curr.id)
        const field = {
          ...curr,
          required: isConditionalRequiredField || curr.required,
          wowDatatype,
        }
        field.isDetailedModeField = !field.required
        if (field.wowDatatype === selectFieldType) {
          const strategy = getAllowedValsStrategy(field)
          field.allowedValues = strategy(curr.allowedValues)
          field.isWideSelect = wideSelectObsFieldIds.includes(curr.id)
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
      const isForm1Present = (() => {
        const o = this.observationDetail || {}
        return !!(o.lat && o.lng)
      })()
      const isForm2Present = (() => {
        return !!(this.obsLat && this.obsLng)
      })()
      return isForm1Present || isForm2Present
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
    isDetailedUserMode() {
      setTimeout(() => {
        this.scrollToSpeciesGuess()
      }, 300)
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
      this.uuidOfThisObs = this.observationDetail.uuid
      this.obsLat = this.observationDetail.lat
      this.obsLng = this.observationDetail.lng
      this.obsLocAccuracy = this.observationDetail.positional_accuracy
      obsFieldsPromise.then(() => {
        this.setDefaultObsFieldVisibility()
        this.setDefaultAnswers()
        this.setDefaultDisabledness()
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
        this.observationDetail.obsFieldValues
          .filter(e => e.datatype === numericFieldType)
          .forEach(currNumericField => {
            const fieldId = currNumericField.fieldId
            const val = this.obsFieldValues[fieldId]
            this._onNumberChange(fieldId, val)
          })
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
      const newVal = event.target.value
      this._onNumberChange(fieldId, newVal)
    },
    _onNumberChange(fieldId, newVal) {
      this.requiredFieldIdsConditionalOnNumberFields = []
      switch (fieldId) {
        case countOfIndividualsObsFieldId:
          this.isPopulationRecord = parseInt(newVal) > 1
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
            // we need to reset this so the conditionally required fields lose
            // their required-ness (and hide) without extra logic
            this.obsFieldValues[
              accuracyOfSearchAreaCalcObsFieldId
            ] = notCollected
          }
          this.refreshVisibilityOfPopulationRecordFields()
          this.refreshVisibilityOfSearchAreaFields()
          break
      }
    },
    handleObsFieldOptionalToRequired(obsFieldId) {
      const val = this.obsFieldValues[obsFieldId]
      const isAnythingButNotCollected = val !== notCollected
      const isNotFalsy = !!val
      if (isAnythingButNotCollected && isNotFalsy) {
        return
      }
      this.obsFieldValues[obsFieldId] = null
    },
    handleObsFieldRequiredToOptional(obsFieldId) {
      const isAnythingButNull = this.obsFieldValues[obsFieldId] !== null
      if (isAnythingButNull) {
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
    scrollToSpeciesGuess() {
      const el = (this.$refs.speciesGuessRef || {}).$el
      if (!el) {
        wowErrorHandler('Failed to find species guess ref to scroll to')
        return
      }
      el.scrollIntoView({ behavior: 'smooth' })
    },
    showHelp(section) {
      this.$wow.uiTrace('SingleSpecies', `show help for section ${section}`)
      this.$store.commit('ephemeral/showHelpModal')
      this.targetHelpSection = section
    },
    helpModalPostShow() {
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
      this.$wow.uiTrace('SingleSpecies', `delete photo`)
      const isLocalFromPreviousEdit = !!record.id
      if (record.isRemote || isLocalFromPreviousEdit) {
        const id = record.id
        this.photoIdsToDelete.push(id)
        this.uploadedPhotos = this.uploadedPhotos.filter(p => p.id !== id)
        this.closePhotoPreview()
        return
      }
      const thisPhotoUuid = record.uuid
      this.$store.commit('ephemeral/popCoordsForPhoto', thisPhotoUuid)
      const indexOfPhoto = this.photos.findIndex(e => e.uuid == thisPhotoUuid)
      if (indexOfPhoto < 0) {
        // why can't we find the photo?
        console.warn(
          `Data problem: could not find photo with UUID='${thisPhotoUuid}'`,
        )
        this.closePhotoPreview()
        return
      }
      this.photos.splice(indexOfPhoto, 1)
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
            accum[curr.id] = (() => {
              if (curr.required) {
                return null
              }
              const speciallyHandledFields = {
                [accuracyOfSearchAreaCalcObsFieldId]: notCollected,
                [areaOfPopulationObsFieldId]: null,
              }
              if (
                Object.keys(speciallyHandledFields).find(
                  k => parseInt(k) === curr.id,
                )
              ) {
                return speciallyHandledFields[curr.id]
              }
              return curr.allowedValues[0].value
            })()
            return accum
          },
          {},
        )
        this.setDefaultIfSupplied(
          countOfIndividualsObsFieldId,
          countOfIndividualsObsFieldDefault,
        )
        this.setDefaultIfSupplied(
          accuracyOfPopulationCountObsFieldId,
          accuracyOfPopulationCountObsFieldDefault,
        )
      } catch (err) {
        // FIXME UI doesn't reflect this error, is it because we're in beforeMount()?
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
      this.isValidatedAtLeastOnce = true
      // TODO Enhancement idea: highlight the fields with error and maybe scroll
      // to the first field
      this.formErrorMsgs = []
      if (!this.speciesGuessValue) {
        this.formErrorMsgs.push(
          'You must identify this observation with a species name',
        )
      }
      if (!this.isLocationAlreadyCaptured) {
        this.formErrorMsgs.push('No geolocation/GPS coordinates recorded.')
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
      this.$wow.uiTrace('SingleSpecies', `save`)
      this.$store.commit('ephemeral/disableWarnOnLeaveRoute')
      const timeoutId = setTimeout(() => {
        this.isShowModalForceClose = true
      }, 30 * 1000)
      try {
        this.isSaveModalVisible = true
        this.isShowModalForceClose = false
        while (this.photosStillCompressingCount > 0) {
          await new Promise(resolve => {
            // TODO do we need a sanity check that breaks out after N tests?
            const waitForImageCompressionMs = 333
            setTimeout(() => {
              return resolve()
            }, waitForImageCompressionMs)
          })
        }
        if (!this.validateInputs()) {
          this.$wow.uiTrace('SingleSpecies', `validation failure`)
          this.$store.commit('ephemeral/enableWarnOnLeaveRoute')
          return
        }
        this.updateRecentlyUsedTaxa()
        const strategyKey = this.isEdit ? 'Edit' : 'New'
        const strategy = this['doSave' + strategyKey]
        if (!strategy) {
          throw new Error(
            `Programmer error: unhandled strategy='${strategyKey}'`,
          )
        }
        const record = this.buildRecordToSave()
        await strategy(record)
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
    },
    buildRecordToSave() {
      const obsFieldValues = this.displayableObsFields.reduce(
        (accum, currField) => {
          const isNotSavable =
            !this.isDetailedUserMode && currField.isDetailedModeField
          if (isNotSavable) {
            return accum
          }
          const isMultiselect = currField.wowDatatype === multiselectFieldType
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
      )
      const result = {
        addedPhotos: this.photos.map(curr => ({
          type: curr.type,
          file: curr.file,
        })),
        speciesGuess: this.speciesGuessValue,
        obsFieldValues,
        description: this.notes,
        lat: this.obsLat,
        lng: this.obsLng,
        positional_accuracy: this.obsLocAccuracy,
      }
      return result
    },
    updateRecentlyUsedTaxa() {
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
    },
    async doSaveNew(record) {
      const newUuid = await this.$store.dispatch(
        'obs/saveNewAndScheduleUpload',
        record,
      )
      this.toastSavedMsg()
      console.debug(`Navigating user to detail page for '${newUuid}'`)
      this.$router.replace({ name: 'ObsDetail', params: { id: newUuid } })
    },
    async doSaveEdit(record) {
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
      const wowId = await this.$store.dispatch(
        'obs/saveEditAndScheduleUpdate',
        {
          record: Object.assign(
            {
              uuid: this.uuidOfThisObs,
            },
            record,
          ),
          photoIdsToDelete: this.photoIdsToDelete,
          obsFieldIdsToDelete,
        },
      )
      this.toastSavedMsg()
      this.$router.replace({
        name: 'ObsDetail',
        params: { id: wowId },
      })
    },
    toastSavedMsg() {
      setTimeout(() => {
        // TODO should this say something about uploading (or not if
        // offline)? We don't want to confuse "saved" with "uploaded to inat"
        this.$ons.notification.toast('Successfully saved', {
          timeout: 5000,
          animation: 'ascend',
          // TODO add dismiss button
        })
      }, 800)
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
      this.$wow.uiTrace('SingleSpecies', `photo attached`)
      const type = photoDefObj.id
      const file = this.$refs[this.photoRef(photoDefObj)][0].files[0]
      if (!file) {
        return
      }
      const theUuid = uuid()
      const photoObj = {
        type,
        file,
        url: URL.createObjectURL(file),
        uuid: theUuid,
      }
      this.photos.push(photoObj)
      // here we use the full size photo but send it for compression/resizing in
      // the worker (background) so we don't block the UI.
      this.$store
        .dispatch('ephemeral/processPhoto', photoObj)
        .then(photoBlobish => {
          const found = this.photos.find(e => e.uuid === theUuid)
          if (!found) {
            // guess the photo has already been deleted?
            return
          }
          found.file = photoBlobish
          const oldUrl = found.url
          const newUrl = URL.createObjectURL(photoBlobish)
          if (oldUrl === newUrl) {
            // createObjectURL seems to always generate a new URL, but just to
            // be safe, we'll check. Don't wanna revoke the one we're using.
            return
          }
          found.url = newUrl
          // we don't want our thumbnail to be using a revoked blob URL
          this.$store.commit('ephemeral/updateUrlForPhotoCoords', {
            uuid: photoObj.uuid,
            newUrl,
          })
          URL.revokeObjectURL(oldUrl)
        })
        .catch(err => {
          wowWarnHandler('Failed to compress/resize an image', err)
        })
    },
    async _onSpeciesGuessInput(data) {
      this.speciesAutocompleteErrors.speciesGuess = false
      try {
        this.speciesGuessAutocompleteItems = await this.$store.dispatch(
          'obs/doSpeciesAutocomplete',
          data.value,
          autocompleteTypeOrchid,
        )
      } catch (err) {
        wowErrorHandler(
          `Failed to do species autocomplete for species guess`,
          err,
        )
        this.speciesAutocompleteErrors.speciesGuess = true
        this.speciesGuessAutocompleteItems = []
      }
    },
    async _onTaxonQuestionInput(data) {
      const fieldId = data.extra
      try {
        const config = {
          [hostTreeSpeciesObsFieldId]: autocompleteTypeHost,
        }
        const speciesListType = config[fieldId]
        if (!speciesListType) {
          throw new Error(
            `Programmer problem: unhandled fieldId=${fieldId} for doing ` +
              `species autocomplete`,
          )
        }
        const vals = await this.$store.dispatch(
          'obs/doSpeciesAutocomplete',
          data.value,
          speciesListType,
        )
        this.taxonQuestionAutocompleteItems[fieldId] = vals
      } catch (err) {
        wowErrorHandler(
          `Failed to do species autocomplete for fieldId=${fieldId}`,
          err,
        )
        this.speciesAutocompleteErrors[fieldId] = true
        this.taxonQuestionAutocompleteItems[fieldId] = []
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
      this.$wow.uiTrace('SingleSpecies', `preview photo`)
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
    onNumberInput(event) {
      event.target.blur()
    },
    onCancel() {
      const modeName = this.isEdit ? 'edit' : 'create'
      this.$wow.uiTrace('SingleSpecies', `cancel ${modeName} observation`)
    },
    rereadCoords() {
      const newCoords = this.$store.getters[
        'ephemeral/coordsForCurrentlyEditingObs'
      ]
      if (!newCoords) {
        this.obsLat = null
        this.obsLng = null
        this.obsLocAccuracy = null
        console.debug('cleared coords triggered by a poke')
        return
      }
      this.obsLat = newCoords.lat
      this.obsLng = newCoords.lng
      this.obsLocAccuracy = newCoords.accuracy
      console.debug('updated coords triggered by a poke')
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

  .faux-div {
    display: block;
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
  height: 20vh;
}

.error-msg-list {
  text-align: left;
}

.wow-select {
  width: 80%;
}

.form-error-dialogue {
  width: 90vw;
  padding: 1em;

  h3 {
    margin: 0;
  }
}

.be-wide {
  flex-grow: 1;
}

.detailed-mode-switch-container {
  margin-top: 10em;
}
</style>
