<template>
  <v-ons-page>
    <custom-toolbar cancellable :title="title">
      <template v-slot:right>
        <v-ons-toolbar-button @click="onSave">Save</v-ons-toolbar-button>
      </template>
    </custom-toolbar>
    <v-ons-list>
      <v-ons-list-item v-show="geolocationErrorMsg" modifier="nodivider">
        <div class="geoloc-error">
          <p>
            <v-ons-icon
              class="warning"
              icon="fa-exclamation-circle"
            ></v-ons-icon>
            {{ geolocationErrorMsg }}. This observation will
            <strong>NOT</strong> have any location information.
          </p>
        </div>
      </v-ons-list-item>
      <v-ons-list-item modifier="nodivider">
        Provide responses for at least all the required questions, then press
        the save button.
      </v-ons-list-item>
      <template v-for="currMenuItem of photoMenu">
        <wow-header
          :key="currMenuItem.name + '-header'"
          :label="currMenuItem.name + ' photos'"
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
          <span class="required">(required)</span>
          What species is this observation of?
        </div>
      </v-ons-list-item>
      <template v-for="currField of displayableObsFields">
        <wow-header
          :key="currField.id + '-list'"
          :label="currField.name"
          :help-target="lookupHelpTarget(currField)"
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
              FIXME - support '{{ currField.wowDatatype }}' field type
            </div>
            <wow-input-status
              v-if="isShowInputStatus(currField)"
              :is-ok="!!obsFieldValues[currField.id]"
              class="the-input-status"
            ></wow-input-status>
          </div>
          <div class="wow-obs-field-desc">
            <span v-if="currField.required" class="required">(required)</span>
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
    <v-ons-alert-dialog
      modifier="rowfooter"
      :visible.sync="formErrorDialogVisible"
    >
      <div slot="title">Invalid value(s) entered</div>
      <p>Please correct the invalid values and try again.</p>
      <ul class="error-msg-list">
        <li v-for="curr of formErrorMsgs" :key="curr">{{ curr }}</li>
      </ul>
      <template slot="footer">
        <v-ons-alert-dialog-button @click="onDismissFormError"
          >Ok</v-ons-alert-dialog-button
        >
      </template>
    </v-ons-alert-dialog>
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
  squareAreaValueToTitle,
  findCommonString,
  getExifFromBlob,
  wowErrorHandler,
} from '@/misc/helpers'
import {
  accuracyOfCountExact,
  accuracyOfPopulationCountObsFieldId,
  approxAreaSearchedObsFieldId,
  areaOfExactCountObsFieldId,
  areaOfPopulationObsFieldId,
  blocked,
  coarseFragmentsMultiselectId,
  conservationImmediateLanduseObsFieldId,
  countOfIndividualsObsFieldDefault,
  countOfIndividualsObsFieldId,
  epiphyteHeightObsFieldId,
  failed,
  floralVisitorsMultiselectId,
  getMultiselectId,
  hostTreeSpeciesObsFieldId,
  immediateLanduseMultiselectId,
  mutuallyExclusiveMultiselectObsFieldIds,
  noValue,
  notCollected,
  notSupported,
  orchidTypeEpiphyte,
  orchidTypeObsFieldId,
  orchidTypeTerrestrial,
  phenologyMultiselectId,
  soilStructureObsFieldId,
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
        { id: 'whole-plant', name: 'Whole plant' },
        { id: 'flower', name: 'Flower' },
        { id: 'leaf', name: 'Leaf' },
        { id: 'habitat', name: 'Habitat' },
        { id: 'micro-habitat', name: 'Micro-habitat' },
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
      isExactCount: false,
      isPopulationRecord: false,
      extraConditionalRequiredFieldIds: [],
      otherType: 'other',
      fieldIdIsDisabled: {},
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
          ...this.extraConditionalRequiredFieldIds,
          areaOfExactCountObsFieldId,
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
    [`obsFieldValues.${accuracyOfPopulationCountObsFieldId}`](newVal) {
      this.isExactCount = newVal === accuracyOfCountExact
      this.refreshVisibilityOfPopulationRecordFields()
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
      })
      this.geolocationErrorMsg = null
      // FIXME show message to prime users about accepting geolocation before
      // this next call. Once we have support for pulling location from EXIF,
      // we could survive without geolocation access.
      this.$store.dispatch('obs/markUserGeolocation').catch(err => {
        console.debug('No geolocation access for us.', err)
        // FIXME notify user that we *need* geolocation
        this.geolocationErrorMsg = (function() {
          if (err === notSupported) {
            return 'Geolocation is not supported by your device'
          }
          if (err === blocked) {
            // TODO add links for how to un-block location access
            return 'You have blocked access to geolocation'
          }
          if (err === failed) {
            return (
              `Geolocation seems to be supported and not blocked but ` +
              'something went wrong while accessing your position'
            )
            // TODO add message about retrying? Maybe add a button to retry?
          }
          wowErrorHandler(
            'ProgrammerError: geolocation access failed but in a' +
              ' way that we did not plan for, we should handle this. ' +
              `err.code=${err.code}.`,
            err,
          )
          return 'Something went wrong while trying to access your geolocation'
        })()
      })
    },
    initForEdit(obsFieldsPromise) {
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
      // FIXME support changing, or at least showing, geolocation
    },
    onNumberChange(event, fieldId) {
      // we should be able to use the Vue "watch" to achieve this but I
      // couldn't get it to work on number fields (the watcher never gets
      // fired) hence this hack. If you get the watcher working, delete
      // this mess.
      this.extraConditionalRequiredFieldIds = []
      const newVal = event.target.value
      switch (fieldId) {
        case countOfIndividualsObsFieldId:
          this.isPopulationRecord =
            parseInt(newVal) > countOfIndividualsObsFieldDefault
          this.obsFieldValues[areaOfPopulationObsFieldId] = null
          if (this.isPopulationRecord) {
            this.extraConditionalRequiredFieldIds.push(
              approxAreaSearchedObsFieldId,
            )
            this.extraConditionalRequiredFieldIds.push(
              areaOfPopulationObsFieldId,
            )
            const isSetToNotCollected =
              this.obsFieldValues[approxAreaSearchedObsFieldId] === notCollected
            if (isSetToNotCollected) {
              this.obsFieldValues[approxAreaSearchedObsFieldId] = null
            }
          } else {
            // individual record
            const isSetToNull =
              this.obsFieldValues[approxAreaSearchedObsFieldId] === null
            if (isSetToNull) {
              this.obsFieldValues[approxAreaSearchedObsFieldId] = notCollected
            }
          }
          this.refreshVisibilityOfPopulationRecordFields()
          break
      }
    },
    refreshVisibilityOfPopulationRecordFields() {
      this.obsFieldVisibility[areaOfExactCountObsFieldId] =
        this.isExactCount && this.isPopulationRecord
      this.obsFieldVisibility[
        areaOfPopulationObsFieldId
      ] = this.isPopulationRecord
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
      if (record.isRemote) {
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
            `(name='${
              fieldDef.name
            }') to value='${defaultValue}' as it's not ` +
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
    validateInputs() {
      // TODO highlight the fields with error
      // TODO validate as the user inputs values
      this.formErrorMsgs = []
      if (!this.speciesGuessValue) {
        this.formErrorMsgs.push(
          'You must identify this observation with a species name',
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
        if (!this.validateInputs()) {
          return
        }
        this.isSaveModalVisible = true
        this.isShowModalForceClose = false
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
        } else {
          await this.$store.dispatch('obs/saveNewAndScheduleUpload', record)
        }
        setTimeout(() => {
          // FIXME should this say something about uploading (or not if
          // offline)? We don't want to confuse "saved" with "uploaded to inat"
          this.$ons.notification.toast('Successfully saved', {
            timeout: 5000,
            animation: 'ascend',
            // TODO add dismiss button
          })
        }, 800)
        this.$router.replace({ name: 'Home' }) // TODO not ideal because the history will probably have two 'Home' entries back to back
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
      this.photos.push({
        type,
        file,
        url: URL.createObjectURL(file),
        uuid: uuid(),
      })
      const exifData = await getExifFromBlob(file)
      if (exifData) {
        // FIXME if we don't already have geolocation then pull lat, long,
        // accuracy and altitude from EXIF data if present, and use it in the obs
        console.debug(
          `Pre-compression GPS related metadata = ` +
            JSON.stringify(exifData, onlyGpsFieldsFrom(exifData), 2),
        )
      }
      function onlyGpsFieldsFrom(exifData) {
        return Object.keys(exifData).filter(e =>
          e.toLowerCase().includes('gps'),
        )
      }
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
    lookupHelpTarget(field) {
      // FIXME we need all obs fields IDs (that have help) defined as env var
      // constants so we can create this mapping
      const mapping = {
        [orchidTypeObsFieldId]: 'orchid-type',
        [immediateLanduseMultiselectId]: 'landuse-types',
        [floralVisitorsMultiselectId]: 'floral-visitors',
        [widerLanduseObsFieldId]: 'landuse-types',
        [43]: 'litter',
        [46]: 'landform-element',
        [62]: 'dominant-phenology',
        [phenologyMultiselectId]: 'phenology-occurring',
        // FIXME populate the rest
      }
      const key = field.id
      return mapping[key]
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
  const squareAreaMapper = vals =>
    vals.filter(excludeNotCollectedForRequiredFilter).map(v => {
      return { value: v, title: squareAreaValueToTitle(v) }
    })
  const strats = {
    [approxAreaSearchedObsFieldId]: squareAreaMapper,
    [areaOfExactCountObsFieldId]: squareAreaMapper,
    [areaOfPopulationObsFieldId]: squareAreaMapper,
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
  margin: 0.1em 0;
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

// FIXME - make these map styles global?
.map-container {
  padding: 2em 0;
}

.map-container img {
  width: 90vw;
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

.warning {
  color: #ff9900;
  margin-right: 0.25em;
}

.geoloc-error {
  border: 1px solid #ff9900;
  border-radius: 5px;
  background: #ffe7a2;
  padding-left: 1em;
  padding-right: 1em;
  margin: 0 auto;
}
</style>
