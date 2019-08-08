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
      <!-- FIXME show conditionally, only when there are uploaded photos -->
      <template v-if="uploadedPhotos.length">
        <v-ons-list-item>
          <div class="photo-title">Uploaded photos</div>
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
      <v-ons-list-item tappable modifier="nodivider">
        <!-- FIXME suggest recently used species or nearby ones -->
        <v-ons-input
          v-model="speciesGuess"
          float
          placeholder="e.g. snail orchid"
          type="text"
          @keyup="onSpeciesInput"
        >
        </v-ons-input>
      </v-ons-list-item>
      <div v-show="isShowSpeciesAutocomplete">
        <ul>
          <!-- FIXME do we use name or common name? -->
          <!-- FIXME turn this into an actual autocomplete, bootstrap-vue has a good one -->
          <li
            v-for="curr of speciesAutocompleteItems"
            :key="curr.id"
            class="autocomplete-item"
            @click="doSelectAutocomplete(curr.name)"
          >
            {{ curr.name }}
          </li>
        </ul>
      </div>
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
          <!-- FIXME show *required* marker -->
          <!-- FIXME allow deselecting a value from optional -->
          <!-- FIXME turn yes/no questions into switches -->
          <div class="wow-obs-field-input-container">
            <v-ons-select
              v-if="currField.wowDatatype === 'select'"
              v-model="obsFieldValues[currField.id]"
              style="width: 80%"
            >
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
            </v-ons-input>
            <textarea
              v-else-if="currField.wowDatatype === 'text'"
              v-model="obsFieldValues[currField.id]"
              placeholder="Input value"
              class="wow-textarea"
            >
            </textarea>
            <div v-else :key="currField.id + '-fixme'" style="color: red;">
              FIXME - support '{{ currField.wowDatatype }}' field type
            </div>
          </div>
          <div v-show="currField.description" class="wow-obs-field-desc">
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
  </v-ons-page>
</template>

<script>
import { mapState } from 'vuex'
import { verifyWowDomainPhoto } from '@/misc/helpers'

// TODO add a guard for page refresh to warn about lost changes, mainly for
// webpage users

export default {
  name: 'Individual',
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
      notes: null,
      isShowSpeciesAutocomplete: false,
      photoIdsToDelete: [],
    }
  },
  computed: {
    ...mapState('obs', ['obsFields', 'lat', 'lng', 'speciesAutocompleteItems']),
    displayableObsFields() {
      // TODO create config file in /public so the client updates it more
      // frequently than the app code itself
      // FIXME set invisible flag when orchidType !== epiphyte
      //   - host tree species
      //   - epiphyte height
      // FIXME set invisible flag when doing individual
      //   - accuracy of count
      //   - count of individuals recorded
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
    isEdit() {
      // TODO should be able to wire directly into the props:{} of
      // this component but suspect Onsen gets in the way.
      return this.$route.matched[0].props.default.isEdit
    },
    title() {
      return this.isEdit ? 'Edit observation' : 'New observation'
    },
  },
  mounted() {
    this.photos = this.photoMenu.reduce((accum, curr) => {
      // prepopulate the keys of photos so they're watched by Vue
      accum[curr.id] = null
      return accum
    }, {})
    const obsFieldsPromise = this.$store.dispatch('obs/getObsFields')
    if (this.isEdit) {
      const obsDetail = this.$store.getters['obs/observationDetail']
      obsFieldsPromise.then(() => {
        // pre-populate obs fields
        this.obsFieldValues = obsDetail.obsFieldValues.reduce((accum, curr) => {
          accum[curr.fieldId] = curr.value
          return accum
        }, {})
      })
      if (obsDetail.speciesGuess) {
        this.speciesGuess = obsDetail.speciesGuess
      }
      if (obsDetail.notes) {
        this.notes = obsDetail.notes
      }
      // pre-populate photos
      // FIXME we don't know what type any given photo is, how can we store
      // this on the server? A do-not-edit obs field just for metadata?
      this.uploadedPhotos = obsDetail.photos
      // FIXME support changing, or at least showing, geolocation
    } else {
      // "new" mode
      obsFieldsPromise.then(() => {
        this.setDefaultAnswers()
      })
      this.$store.dispatch('obs/markUserGeolocation')
    }
  },
  methods: {
    onCancel() {
      // FIXME implement, is there anything to clean up or is it all local?
    },
    onDeleteUploadedPhoto(record) {
      const id = record.id
      this.photoIdsToDelete.push(id)
      this.uploadedPhotos = this.uploadedPhotos.filter(p => p.id !== id)
    },
    setDefaultAnswers() {
      // FIXME are these defaults ok? Should we be smarter like picking the last used values?
      this.obsFieldValues = this.displayableObsFields.reduce((accum, curr) => {
        const hasSelectOptions = (curr.allowedValues || []).length
        if (!hasSelectOptions) {
          return accum
        }
        accum[curr.id] = curr.allowedValues[0]
        return accum
      }, {})
    },
    async onSave() {
      try {
        const record = {
          photos: this.photoMenu.reduce((accum, curr, $index) => {
            const currPhoto = this.photos[curr.id]
            if (!currPhoto) {
              return accum
            }
            const tempId = -1 * $index
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
              const obsFieldDef = this.displayableObsFields.find(
                e => e.id == currKey,
              )
              if (!obsFieldDef) {
                // FIXME notify Sentry of error, but do we push on? And if so,
                // do we either hide this element or show an error message inplace
                // of it?
              }
              accum.push({
                fieldId: parseInt(currKey),
                name: obsFieldDef.name,
                value: this.obsFieldValues[currKey],
                datatype: obsFieldDef.datatype,
              })
              return accum
            },
            [],
          ),
          description: this.notes,
        }
        if (this.isEdit) {
          // FIXME check if anything has changed before continuing
          await this.$store.dispatch('obs/saveEditAndScheduleUpdate', {
            record,
            existingRecordId: this.$store.state.obs.selectedObservationId,
            photoIdsToDelete: this.photoIdsToDelete,
            // FIXME what about setting optional obs fields to have no value? DELETE them?
          })
        } else {
          await this.$store.dispatch('obs/saveAndScheduleUpload', record)
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
    async onSpeciesInput() {
      await this.$store.dispatch('obs/doSpeciesAutocomplete', this.speciesGuess)
      this.isShowSpeciesAutocomplete = true
    },
    doSelectAutocomplete(selected) {
      this.speciesGuess = selected
      this.isShowSpeciesAutocomplete = false
    },
    photoRef(e) {
      return 'photo-' + e.id
    },
  },
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

.autocomplete-item {
  margin: 1em auto;
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
}
</style>
