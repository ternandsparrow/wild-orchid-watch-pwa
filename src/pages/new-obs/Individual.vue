<template>
  <v-ons-page>
    <!-- FIXME add confirmation to cancel -->
    <custom-toolbar back-label="Cancel" title="New individual observation">
      <template v-slot:right>
        <v-ons-toolbar-button @click="onSave">Save</v-ons-toolbar-button>
      </template>
    </custom-toolbar>
    <v-ons-list>
      <v-ons-list-header>Photos</v-ons-list-header>
      <v-ons-list-item :modifier="md ? 'nodivider' : ''">
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
              <!-- FIXME allow deleting photo -->
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
      <v-ons-list-header>Species guess</v-ons-list-header>
      <v-ons-list-item tappable modifier="longdivider">
        <!-- FIXME suggest recently used species or nearby ones -->
        <v-ons-input
          v-model="speciesGuess"
          float
          placeholder="e.g. snail orchid"
          type="text"
        >
        </v-ons-input>
      </v-ons-list-item>
      <template v-for="currField of filteredFields">
        <v-ons-list-header :key="currField.id + '-list'">{{
          currField.name
        }}</v-ons-list-header>
        <!-- <v-ons-list-item>{{ currField.description }}</v-ons-list-item> -->
        <template v-if="currField.datatype === 'text'">
          <v-ons-list-item
            v-for="(currValue, $index) in currField.allowedValues"
            :key="currField.id + '-' + $index"
            tappable
            :modifier="
              $index === currField.allowedValues.length - 1 ? 'longdivider' : ''
            "
          >
            <label class="left">
              <v-ons-radio
                v-model="obsFieldValues[currField.id]"
                :input-id="'field-' + currField.id + '-' + $index"
                :value="currValue"
              >
              </v-ons-radio>
            </label>
            <label :for="'field-' + currField.id + '-' + $index" class="center">
              {{ currValue }}
            </label>
          </v-ons-list-item>
        </template>
        <v-ons-list-item
          v-if="currField.datatype === 'numeric'"
          :key="currField.id + '-numeric'"
        >
          <v-ons-input
            v-model="obsFieldValues[currField.id]"
            float
            placeholder="Input value"
            type="number"
          >
          </v-ons-input>
        </v-ons-list-item>
      </template>
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
    }
  },
  computed: {
    ...mapState('obs', ['obsFields', 'lat', 'lng']),
    filteredFields() {
      // FIXME remove when we can handle species picker
      return (this.obsFields || []).filter(
        e => [20267, 20225].indexOf(e.id) === -1,
      )
    },
  },
  mounted() {
    this.$store.dispatch('obs/getObsFields')
    this.photos = this.photoMenu.reduce((accum, curr) => {
      // prepopulate the keys of photos so they're watched by Vue
      accum[curr.id] = null
      return accum
    }, {})
    this.$store.dispatch('obs/markUserGeolocation')
  },
  methods: {
    async onSave() {
      try {
        const record = {
          photos: this.photoMenu
            .map(e => {
              const currPhoto = this.photos[e.id]
              if (!currPhoto) {
                return null // FIXME ok?
              }
              return currPhoto.file
            })
            .filter(e => !!e),
          orchidType: this.selectedOrchidType,
          species_guess: this.speciesGuess,
          // FIXME get answers to obs field questions
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
</style>
