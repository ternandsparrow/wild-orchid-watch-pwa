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
        <v-ons-carousel
          item-width="20%"
          item-height="200px"
          swipeable
          overscrollable
        >
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
              <v-ons-icon
                v-if="!photos[curr.id]"
                class="the-icon"
                icon="md-image-o"
              ></v-ons-icon>
              <!-- FIXME photos doesn't seem to be reactive -->
              <img
                v-if="photos[curr.id]"
                :alt="curr.name + ' photo'"
                :src="photos[curr.id].url"
                class="thumbnail"
              />
              <div class="photo-label-text">{{ curr.name }}</div>
            </label>
          </v-ons-carousel-item>
        </v-ons-carousel>
      </v-ons-list-item>
      <v-ons-list-header>Orchid type</v-ons-list-header>
      <v-ons-list-item
        v-for="(curr, $index) in orchidTypes"
        :key="curr.id"
        tappable
        :modifier="$index === orchidTypes.length - 1 ? 'longdivider' : ''"
      >
        <label class="left">
          <v-ons-radio
            v-model="selectedOrchidType"
            :input-id="'orchidType-' + curr.id"
            :value="curr.id"
          >
          </v-ons-radio>
        </label>
        <label :for="'orchidType-' + curr.id" class="center">
          {{ curr.label }}
        </label>
      </v-ons-list-item>
    </v-ons-list>
  </v-ons-page>
</template>

<script>
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
      photos: {},
      selectedOrchidType: 'epi',
      orchidTypes: [
        { id: 'epi', label: 'Epiphyte' },
        { id: 'ter', label: 'Terrestrial' },
        { id: 'lit', label: 'Lithophyte' },
      ],
    }
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
  height: 100px;
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
  padding-top: 0.5em;
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

.thumbnail {
  width: 40px;
  height: 40px;
}
</style>
