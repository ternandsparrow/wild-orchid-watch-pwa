<template>
  <v-ons-page>
    <custom-toolbar cancellable :title="title" @cancelled="onCancel">
      <template v-slot:right>
        <v-ons-toolbar-button @click="onSave">Save</v-ons-toolbar-button>
      </template>
    </custom-toolbar>
    <v-ons-list>
      <v-ons-list-header class="wow-list-header">Photos</v-ons-list-header>
      <div class="photo-container">
        <div
          v-for="(curr, $index) of photoMenu"
          :key="curr.name"
          class="photo-item"
        >
          <input
            :id="'photo' + $index"
            :ref="photoRef(curr)"
            type="file"
            :name="'photo' + $index"
            accept="image/png, image/jpeg"
            class="photo-button"
            @change="onPhotoAdded(curr)"
          />
          <label :for="'photo' + $index">
            <!-- FIXME allow deleting photo. You can by browsing and cancelling but that's obscure -->
            <div class="thumb-container">
              <v-ons-icon
                v-if="!photos[curr.id]"
                class="the-icon"
                icon="md-image-o"
              ></v-ons-icon>
              <div
                v-if="photos[curr.id]"
                :style="{
                  'background-image': 'url(' + photos[curr.id].url + ')',
                }"
              ></div>
            </div>
            <div class="photo-label-text">{{ curr.name }}</div>
          </label>
        </div>
      </div>
      <template v-if="uploadedPhotos.length">
        <v-ons-list-item>
          <div class="photo-title">Existing photos</div>
        </v-ons-list-item>
        <v-ons-list-item>
          <div
            v-for="curr of uploadedPhotos"
            :key="curr.id"
            class="uploaded-photo-item"
          >
            <!-- TODO add click event to photo to open larger view -->
            <img :src="curr.url" />
            <div
              class="text-center less-prominent"
              @click="onDeleteUploadedPhoto(curr)"
            >
              <v-ons-icon icon="md-delete"></v-ons-icon>
            </div>
          </div>
        </v-ons-list-item>
      </template>
      <v-ons-list-header class="wow-list-header">Field Name</v-ons-list-header>
      <v-ons-list-item>
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
        <v-ons-list-header
          :key="currField.id + '-list'"
          class="wow-list-header"
          >{{ currField.name }}</v-ons-list-header
        >
        <v-ons-list-item
          :key="currField.id + '-obs-field'"
          modifier="nodivider"
        >
          <!-- FIXME turn yes/no questions into switches -->
          <div class="wow-obs-field-input-container">
            <v-ons-select
              v-if="currField.wowDatatype === selectFieldType"
              v-model="obsFieldValues[currField.id]"
              style="width: 80%"
            >
              <option v-if="!currField.required" :value="null">
                (No value)
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
            <div v-else style="color: red;">
              FIXME - support '{{ currField.wowDatatype }}' field type
            </div>
          </div>
          <div class="wow-obs-field-desc">
            <span v-if="currField.required" class="required">(required)</span>
            {{ currField.description }}
          </div>
        </v-ons-list-item>
      </template>
      <v-ons-list-header class="wow-list-header">Notes</v-ons-list-header>
      <v-ons-list-item>
        <v-ons-input
          v-model="notes"
          class="width100"
          type="text"
          placeholder="anything else noteworthy"
        ></v-ons-input>
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
  </v-ons-page>
</template>

<script>
import EXIF from 'exif-js'
import imageCompression from 'browser-image-compression'
import { mapState, mapGetters } from 'vuex'
import { isNil, trim, isEmpty, debounce, cloneDeep } from 'lodash'
import {
  blobToArrayBuffer,
  verifyWowDomainPhoto,
  approxAreaSearchValueToTitle,
} from '@/misc/helpers'
import {
  accuracyOfCountObsFieldDefault,
  accuracyOfCountObsFieldId,
  approxAreaSearchedObsFieldId,
  countOfIndividualsObsFieldDefault,
  countOfIndividualsObsFieldId,
  epiphyteHeightObsFieldId,
  hostTreeSpeciesObsFieldId,
  orchidTypeEpiphyte,
  orchidTypeObsFieldDefault,
  orchidTypeObsFieldId,
} from '@/misc/constants'

const speciesGuessRecentTaxaKey = 'speciesGuess'
const taxonFieldType = 'taxon'
const numericFieldType = 'numeric'
const selectFieldType = 'select'

// TODO add a guard for page refresh to warn about lost changes, mainly for
// webpage users

export default {
  name: 'SingleSpecies',
  data() {
    return {
      photoMenu: [
        { id: 'whole', name: 'Whole plant' },
        { id: 'top', name: 'Top' },
        { id: 'leaf', name: 'Leaf' },
        { id: 'mhab', name: 'Micro-habitat' },
        { id: 'pol', name: 'Visiting pollinators' },
        { id: 'hab', name: 'Habitat' },
      ],
      speciesGuessInitialValue: null,
      speciesGuessSelectedItem: null,
      speciesGuessValue: null,
      photos: {},
      currentPosition: null,
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
      formErrorDialogVisible: false,
      formErrorMsgs: [],
      existingRecordSnapshot: null,
    }
  },
  computed: {
    ...mapState('obs', ['lat', 'lng']),
    ...mapGetters('obs', ['observationDetail', 'obsFields']),
    ...mapState('ephemeral', ['networkOnLine']),
    displayableObsFields() {
      const clonedObsFields = this.obsFields.slice(0)
      const result = clonedObsFields.reduce((accum, curr) => {
        if (!this.obsFieldVisibility[curr.id]) {
          return accum
        }
        const hasAllowedValues = (curr.allowedValues || []).length
        const wowDatatype = hasAllowedValues ? selectFieldType : curr.datatype
        const isEpiphyteDependentField = [
          hostTreeSpeciesObsFieldId,
          epiphyteHeightObsFieldId,
        ].includes(curr.id)
        const field = {
          ...curr,
          required: isEpiphyteDependentField ? true : curr.required,
          wowDatatype,
        }
        if (hasAllowedValues) {
          const strategy = getAllowedValsStrategy(curr.id)
          field.allowedValues = strategy(curr.allowedValues)
        }
        accum.push(field)
        return accum
      }, [])
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
  },
  watch: {
    [`obsFieldValues.${orchidTypeObsFieldId}`](newVal) {
      const isEpiphyte = newVal === orchidTypeEpiphyte
      this.obsFieldVisibility[hostTreeSpeciesObsFieldId] = isEpiphyte
      this.obsFieldVisibility[epiphyteHeightObsFieldId] = isEpiphyte
    },
  },
  beforeMount() {
    this.doGeolocation()
    this.photos = this.photoMenu.reduce((accum, curr) => {
      // prepopulate the keys of photos so they're watched by Vue
      accum[curr.id] = null
      return accum
    }, {})
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
  created() {
    this.debouncedOnSpeciesGuessInput = debounce(this._onSpeciesGuessInput, 300)
    this.debouncedOnTaxonQuestionInput = debounce(
      this._onTaxonQuestionInput,
      300,
    )
  },
  methods: {
    initForNew(obsFieldsPromise) {
      obsFieldsPromise.then(() => {
        this.setDefaultObsFieldVisibility()
        this.setDefaultAnswers()
      })
      this.$store.dispatch('obs/markUserGeolocation')
    },
    initForEdit(obsFieldsPromise) {
      obsFieldsPromise.then(() => {
        this.setDefaultObsFieldVisibility()
        this.setDefaultAnswers()
        // pre-populate obs fields
        this.obsFieldValues = this.observationDetail.obsFieldValues.reduce(
          (accum, curr) => {
            accum[curr.fieldId] = curr.value
            return accum
          },
          this.obsFieldValues,
        )
        this.obsFieldInitialValues = cloneDeep(this.obsFieldValues)
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
      // FIXME we don't know what type any given photo is, how can we store
      // this on the server? A do-not-edit obs field just for metadata?
      this.uploadedPhotos = this.observationDetail.photos
      // FIXME support changing, or at least showing, geolocation
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
    onCancel() {
      // FIXME implement, is there anything to clean up or is it all local?
    },
    onDeleteUploadedPhoto(record) {
      const id = record.id
      this.photoIdsToDelete.push(id)
      this.uploadedPhotos = this.uploadedPhotos.filter(p => p.id !== id)
    },
    setDefaultAnswers() {
      try {
        // FIXME are these defaults ok? Should we be smarter like picking the last used values?
        // Or should we have a button to "clone previous observation"?
        this.obsFieldValues = this.displayableObsFields.reduce(
          (accum, curr) => {
            const hasSelectOptions = (curr.allowedValues || []).length
            if (!hasSelectOptions) {
              return accum
            }
            accum[curr.id] = curr.required ? curr.allowedValues[0].value : null
            return accum
          },
          {},
        )
        this.setDefaultIfSupplied(
          accuracyOfCountObsFieldId,
          accuracyOfCountObsFieldDefault,
        )
        this.setDefaultIfSupplied(
          countOfIndividualsObsFieldId,
          countOfIndividualsObsFieldDefault,
        )
        this.setDefaultIfSupplied(
          orchidTypeObsFieldId,
          orchidTypeObsFieldDefault,
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
        if (!isEmpty(trim(val))) {
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
        if (isNil(val) || val > 0) {
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
      try {
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
          photos: (await Promise.all(
            this.photoMenu.map(async (curr, $index) => {
              const currPhoto = this.photos[curr.id]
              if (!currPhoto) {
                return null
              }
              const tempId = -1 * ($index + 1)
              const photo = {
                id: tempId,
                url: '(set at render time)',
                type: curr.id,
                file: {
                  data: await blobToArrayBuffer(currPhoto.file),
                  mime: currPhoto.file.type,
                },
                // TODO read and use user's default settings for these:
                licenseCode: 'default',
                attribution: 'default',
              }
              verifyWowDomainPhoto(photo)
              return photo
            }),
          )).filter(p => !!p),
          speciesGuess: this.speciesGuessValue,
          // FIXME add placeGuess
          obsFieldValues: this.displayableObsFields
            .map(e => e.id)
            .reduce((accum, currFieldId) => {
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
            }, []),
          description: this.notes,
        }
        // FIXME change to strategy pattern
        if (this.isEdit) {
          const obsFieldIdsToDelete = Object.keys(this.obsFieldValues).reduce(
            (accum, currKey) => {
              const value = this.obsFieldValues[currKey]
              const hadValueBeforeEditing = !isNil(
                this.obsFieldInitialValues[currKey],
              )
              const isEmpty = isDeletedObsFieldValue(value)
              if (isEmpty && hadValueBeforeEditing) {
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
          await this.$store.dispatch('obs/saveEditAndScheduleUpdate', {
            record,
            existingRecord: this.existingRecordSnapshot,
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
    async onPhotoAdded(photoDefObj) {
      const type = photoDefObj.id
      const file = this.$refs[this.photoRef(photoDefObj)][0].files[0]
      if (!file) {
        this.photos[type] = null
        return
      }
      console.log(`original image size ${file.size / 1024 / 1024} MB`)
      EXIF.getData(file, function() {
        const allMetaData = EXIF.getAllTags(this)
        console.debug(`allMetaData = ` + JSON.stringify(allMetaData))
      })
      const options = {
        maxSizeMB: 2,
        useWebWorker: true,
        maxIteration: 5,
      }
      try {
        const compressedFile = await imageCompression(file, options)
        console.log(
          `compressedFile size ${compressedFile.size / 1024 / 1024} MB`,
        ) // smaller than maxSizeMB

        // FIXME - this is busted, it seems.
        EXIF.getData(compressedFile, function() {
          const allMetaData = EXIF.getAllTags(this)
          console.debug(
            `compressedFile allMetaData = ` + JSON.stringify(allMetaData),
          )
        })
        this.photos[type] = {
          file,
          url: URL.createObjectURL(file),
        }
      } catch (error) {
        console.log(error)
      }

      /*
      imageCompression(file, options)
        .then(function(compressedFile) {
          console.log(
            `compressedFile size ${compressedFile.size / 1024 / 1024} MB`,
          ) // smaller than maxSizeMB

          // FIXME - this is busted, it seems.
          EXIF.getData(compressedFile, function() {
            const allMetaData = EXIF.getAllTags(this)
            console.debug(
              `compressedFile allMetaData = ` + JSON.stringify(allMetaData),
            )
          })

          this.photos[type] = {
            file,
            url: URL.createObjectURL(file),
          }
        })
        .catch(function(error) {
          console.log(error.message)
        })
        */
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
    doGeolocation() {
      console.debug('Doing geolocation call')
      navigator.geolocation.getCurrentPosition(
        this.handleLocation,
        this.onGeolocationError,
      )
    },
    handleLocation(position) {
      this.currentPosition = position
    },
    onGeolocationError(error) {
      // FIXME handle the error
      this.$ons.notification.alert('FIXME handle the error:' + error)
    },
    snapshotExistingRecord() {
      // if the user edits a local record but the record is uploaded (and
      // cleaned up) before the user hits save, we're in trouble. We can recover
      // as long as we have this snapshot though.
      this.existingRecordSnapshot = cloneDeep(
        this.$store.getters['obs/observationDetail'],
      )
    },
  },
}

function isDeletedObsFieldValue(value) {
  return isNil(value) || (typeof value === 'string' && trim(value).length === 0)
}

function getAllowedValsStrategy(fieldId) {
  const strats = {
    [approxAreaSearchedObsFieldId]: vals =>
      vals.map(v => {
        return { value: v, title: approxAreaSearchValueToTitle(v) }
      }),
  }
  const result = strats[fieldId]
  const defaultStrat = vals => vals.map(v => ({ value: v, title: v }))
  return result || defaultStrat
}
</script>

<style scoped lang="scss">
.photo-container {
  display: flex;
  flex-wrap: wrap;
}

.photo-item {
  background-color: #fff;
  border-radius: 4px;
  text-align: center;
  flex-grow: 1;
  /* TODO add media queries for larger res and more items per row */
  width: 30%;
}

.photo-button {
  width: 0.1px;
  height: 0.1px;
  opacity: 0;
  overflow: hidden;
  position: absolute;
  z-index: -1;
}

.the-icon {
  line-height: 70px;
  font-size: 70px;
  color: #b9b9b9;
}

.photo-label-text {
  font-size: 0.5em;
  color: #111;
  font-weight: normal;
}

.photo-button + label {
  font-size: 2em;
  font-weight: 700;
  color: #5b5b5b;
}

.photo-button:focus + label,
.photo-button + label:hover {
  color: black;
}

.thumb-container {
  height: 70px;
}

.thumb-container div {
  background-size: cover;
  background-position: center center;
  height: 100%;
}

// FIXME - make these map styles global?
.map-container {
  padding: 2em 0;
}

.map-container img {
  width: 90vw;
}

.width100 {
  width: 100%;
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

.uploaded-photo-item {
  margin: 0.25em 0.5em;

  img {
    max-width: 100px;
    max-height: 100px;
  }
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
</style>
