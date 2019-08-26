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
      <v-ons-list-header class="wow-list-header"
        >Species guess</v-ons-list-header
      >
      <v-ons-list-item>
        <!-- FIXME suggest recently used species or nearby ones -->
        <wow-autocomplete
          :items="speciesGuessAutocompleteItems"
          :initial-value="speciesGuess"
          placeholder-text="e.g. snail orchid"
          @change="onSpeciesGuessInput"
          @item-selected="onSpeciesGuessSet"
        />
        <div class="wow-obs-field-desc">
          Which species is this observation of?
        </div>
      </v-ons-list-item>
      <template v-for="currField of displayableObsFields">
        <v-ons-list-header
          v-show="obsFieldVisibility[currField.id]"
          :key="currField.id + '-list'"
          class="wow-list-header"
          >{{ currField.name }}</v-ons-list-header
        >
        <v-ons-list-item
          v-show="obsFieldVisibility[currField.id]"
          :key="currField.id + '-obs-field'"
          modifier="nodivider"
        >
          <!-- FIXME turn yes/no questions into switches -->
          <div class="wow-obs-field-input-container">
            <v-ons-select
              v-if="currField.wowDatatype === 'select'"
              v-model="obsFieldValues[currField.id]"
              style="width: 80%"
            >
              <option v-if="!currField.required" :value="null">
                (No value)
              </option>
              <option
                v-for="(currValue, $index) in currField.allowedValues"
                :key="currField.id + '-' + $index"
                :value="currValue"
              >
                {{ currValue }}
              </option>
            </v-ons-select>
            <v-ons-input
              v-else-if="currField.wowDatatype === 'numeric'"
              v-model="obsFieldValues[currField.id]"
              float
              placeholder="Input value"
              type="number"
            >
              <!-- FIXME validate non-negative and non-zero if applicable -->
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
              :initial-value="obsFieldValues[currField.id]"
              placeholder-text="e.g. snail orchid"
              :extra-callback-data="currField.id"
              @change="onTaxonQuestionInput"
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
  </v-ons-page>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import { isNil, trim } from 'lodash'
import { verifyWowDomainPhoto } from '@/misc/helpers'
import {
  accuracyOfCountObsFieldDefault,
  accuracyOfCountObsFieldId,
  countOfIndividualsObsFieldDefault,
  countOfIndividualsObsFieldId,
  epiphyteHeightObsFieldId,
  hostTreeSpeciesObsFieldId,
  orchidTypeObsFieldDefault,
  orchidTypeObsFieldId,
  orchidTypeEpiphyte,
} from '@/misc/constants'

const speciesGuessRecentTaxaKey = 'speciesGuess'
const taxonFieldType = 'taxon'

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
      speciesGuess: null,
      photos: {},
      uploadedPhotos: [],
      obsFieldValues: {},
      obsFieldInitialValues: {}, // for comparing after edit
      obsFieldVisibility: {},
      notes: null,
      photoIdsToDelete: [],
      speciesGuessAutocompleteItems: [],
      taxonQuestionAutocompleteItems: {},
      taxonFieldType,
    }
  },
  computed: {
    ...mapState('obs', ['obsFields', 'lat', 'lng']),
    ...mapGetters('obs', ['observationDetail']),
    ...mapState('ephemeral', ['networkOnLine']),
    displayableObsFields() {
      const clonedObsFields = this.obsFields.slice(0)
      const result = clonedObsFields.reduce((accum, curr) => {
        const hasAllowedValues = (curr.allowedValues || []).length
        const wowDatatype = hasAllowedValues ? 'select' : curr.datatype
        accum.push({
          ...curr,
          wowDatatype,
        })
        return accum
      }, [])
      result.sort((a, b) => {
        if (a.position < b.position) {
          return -1
        }
        if (a.position > b.position) {
          return 1
        }
        return 0
      })
      return result
    },
    taxonQuestionIds() {
      return this.displayableObsFields
        .filter(f => f.wowDatatype === taxonFieldType)
        .map(e => e.id)
    },
    isEdit() {
      // TODO should be able to wire directly into the props:{isEdit: Boolean}
      // of this component but suspect Onsen gets in the way.
      return this.$route.matched[0].props.default.isEdit
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
    this.photos = this.photoMenu.reduce((accum, curr) => {
      // prepopulate the keys of photos so they're watched by Vue
      accum[curr.id] = null
      return accum
    }, {})
    this.taxonQuestionAutocompleteItems = this.displayableObsFields
      .filter(f => f.wowDatatype === taxonFieldType)
      .reduce((accum, curr) => {
        // prepopulate keys of taxonQuestionAutocompleteItems so they're watched by Vue
        accum[curr.id] = null
        return accum
      }, {})
    // FIXME change to caching locally and checking if stale
    const obsFieldsPromise = this.$store.dispatch('obs/refreshObsFields')
    if (this.isEdit) {
      this.initForEdit(obsFieldsPromise)
    } else {
      this.initForNew(obsFieldsPromise)
    }
    this.setRecentlyUsedTaxa()
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
        this.obsFieldInitialValues = Object.assign({}, this.obsFieldValues)
      })
      if (this.observationDetail.speciesGuess) {
        this.speciesGuess = this.observationDetail.speciesGuess
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
      this.speciesGuessAutocompleteItems = (
        this.$store.state.obs.recentlyUsedTaxa[speciesGuessRecentTaxaKey] || []
      ).map(mapToAutocompleteItem)
      for (const currId of this.taxonQuestionIds) {
        this.taxonQuestionAutocompleteItems[currId] = (
          this.$store.state.obs.recentlyUsedTaxa[currId] || []
        ).map(mapToAutocompleteItem)
      }
      function mapToAutocompleteItem(simpleValue) {
        return { id: simpleValue, name: simpleValue }
      }
    },
    setDefaultObsFieldVisibility() {
      this.obsFieldVisibility = this.displayableObsFields.reduce(
        (accum, curr) => {
          accum[curr.id] = true
          return accum
        },
        {},
      )
    },
    onSpeciesGuessSet(data) {
      this.speciesGuess = data.value
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
            accum[curr.id] = curr.required ? curr.allowedValues[0] : null
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
      const isValidValue =
        fieldDef.wowDatatype !== 'select' ||
        fieldDef.allowedValues.includes(defaultValue)
      if (!isValidValue) {
        throw new Error(
          `Cannot set field ID='${fieldId}' ` +
            `(name='${
              fieldDef.name
            }') to value='${defaultValue}' as it's not ` +
            `in the allowedValues=[${fieldDef.allowedValues}]`,
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
            `ID='${fieldId}' (type=${typeof fieldId}) from available ` +
            `IDs=[${availableIds}]`,
        )
      }
      return result
    },
    async onSave() {
      // TODO assert that all required fields are filled. Currently they have
      // to be because there's always a valid default that can't be unselected.
      // If we change that so all fields require conscious filling, then we need
      // to validate.
      try {
        this.$store.commit('obs/addRecentlyUsedTaxa', {
          type: speciesGuessRecentTaxaKey,
          value: this.speciesGuess,
        })
        for (const currId of this.taxonQuestionIds) {
          this.$store.commit('obs/addRecentlyUsedTaxa', {
            type: currId,
            value: this.obsFieldValues[currId],
          })
        }
        const record = {
          photos: this.photoMenu.reduce((accum, curr, $index) => {
            const currPhoto = this.photos[curr.id]
            if (!currPhoto) {
              return accum
            }
            const tempId = -1 * ($index + 1)
            const photo = {
              id: tempId,
              url: '(set at render time)',
              type: curr.id,
              file: currPhoto.file,
              // TODO read and use user's default settings for these:
              licenseCode: 'default',
              attribution: 'default',
            }
            verifyWowDomainPhoto(photo)
            accum.push(photo)
            return accum
          }, []),
          speciesGuess: this.speciesGuess,
          // FIXME add placeGuess
          obsFieldValues: Object.keys(this.obsFieldValues).reduce(
            (accum, currKey) => {
              const isVisible = this.obsFieldVisibility[currKey]
              if (!isVisible) {
                return accum
              }
              const obsFieldDef = this.getObsFieldDef(currKey)
              const value = this.obsFieldValues[currKey]
              if (isDeletedObsFieldValue(value)) {
                return accum
              }
              accum.push({
                fieldId: parseInt(currKey),
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
                accum.push(obsFieldInstance.relationshipId)
              }
              return accum
            },
            [],
          )
          // FIXME check if anything has changed before continuing
          await this.$store.dispatch('obs/saveEditAndScheduleUpdate', {
            record,
            existingRecordId: this.$store.state.obs.selectedObservationId,
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
        // FIXME show failure to user, any info on how to fix it
        this.$ons.notification.alert('Something went wrong :(')
        throw err // FIXME show alert AND throw? Can we use the global error catcher?
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
    onPhotoAdded(photoDefObj) {
      const type = photoDefObj.id
      const file = this.$refs[this.photoRef(photoDefObj)][0].files[0]
      if (!file) {
        this.photos[type] = null
        return
      }
      this.photos[type] = {
        file,
        url: URL.createObjectURL(file),
      }
    },
    async onSpeciesGuessInput(data) {
      const result = await this.doSpeciesAutocomplete(data.value)
      this.speciesGuessAutocompleteItems = result
    },
    async onTaxonQuestionInput(data) {
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
  },
}

function isDeletedObsFieldValue(value) {
  return isNil(value) || (typeof value === 'string' && trim(value).length === 0)
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
</style>
