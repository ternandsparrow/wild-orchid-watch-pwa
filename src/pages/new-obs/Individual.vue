<template>
  <v-ons-page>
    <!-- FIXME add confirmation to cancel -->
    <custom-toolbar back-label="Cancel" title="New individual observation">
      <template v-slot:right>
        <v-ons-toolbar-button @click="onSave">Save</v-ons-toolbar-button>
      </template>
    </custom-toolbar>
    <v-ons-list>
      <v-ons-list-header class="wow-list-header">Photos</v-ons-list-header>
      <v-ons-list-item :modifier="md ? 'nodivider' : ''">
        <!-- FIXME make it obvious this scrolls or just show all 6 items in a flex grid -->
        <v-ons-carousel item-width="20%" swipeable overscrollable>
          <v-ons-carousel-item
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
          </v-ons-carousel-item>
        </v-ons-carousel>
      </v-ons-list-item>
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
      obsFieldValues: {},
      notes: null,
      isShowSpeciesAutocomplete: false,
    }
  },
  computed: {
    ...mapState('obs', ['obsFields', 'lat', 'lng', 'speciesAutocompleteItems']),
    displayableObsFields() {
      // TODO create config file in /public so the client updates it more
      // frequently than the app code itself
      // FIXME filter out when orchidType !== epiphyte
      //   - host tree species
      //   - epiphyte height
      // FIXME filter out when doing individual
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
  },
  mounted() {
    this.$store.dispatch('obs/getObsFields').then(() => {
      this.setDefaultAnswers()
    })
    this.photos = this.photoMenu.reduce((accum, curr) => {
      // prepopulate the keys of photos so they're watched by Vue
      accum[curr.id] = null
      return accum
    }, {})
    this.$store.dispatch('obs/markUserGeolocation')
  },
  methods: {
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
          photos: this.photoMenu.reduce((accum, curr) => {
            const currPhoto = this.photos[curr.id]
            if (!currPhoto) {
              return accum
            }
            // TODO can we also store "photo type" on the server?
            accum.push(currPhoto.file)
            return accum
          }, []),
          orchidType: this.selectedOrchidType,
          species_guess: this.speciesGuess,
          obsFieldValues: this.obsFieldValues,
          description: this.notes,
        }
        this.$store.dispatch('obs/saveAndUploadIndividual', record)
        setTimeout(() => {
          // FIXME should this say something about uploading (or not if
          // offline)? We don't want to confuse "saved" with "uploaded to inat"
          this.$ons.notification.toast('Successfully saved', {
            timeout: 5000,
            animation: 'ascend',
          })
        }, 800)
        this.$store.commit('navigator/pop')
      } catch (err) {
        // FIXME show failure to user, any info on how to fix it
        this.$ons.notification.alert('Something went wrong :(')
        throw err
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
.photo-item {
  background-color: #fff;
  border-radius: 4px;
  text-align: center;
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
</style>
