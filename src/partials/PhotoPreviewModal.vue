<template>
  <v-ons-modal :visible="isVisible">
    <img
      :src="(previewedPhoto || {}).url"
      class="photo-viewer-image"
      :style="{ 'max-height': windowHeight + 'px' }"
    />
    <div class="photo-viewer-toolbar">
      <div v-if="showDelete">
        <v-ons-button class="delete-btn" @click="onDeletePhoto"
          ><v-ons-icon icon="fa-trash"></v-ons-icon> Delete</v-ons-button
        >
      </div>
      <div v-if="showJump">
        <v-ons-button class="jump-btn" @click="onJump"
          ><v-ons-icon icon="fa-eye"></v-ons-icon> View
          observation</v-ons-button
        >
      </div>
      <div>
        <v-ons-button @click="closePhotoPreview"
          ><v-ons-icon icon="fa-times-circle"></v-ons-icon> Close</v-ons-button
        >
      </div>
    </div>
  </v-ons-modal>
</template>

<script>
import { mapState } from 'vuex'
import { debounce } from 'lodash'

export default {
  name: 'PhotoPreviewModal',
  props: {
    showDelete: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      windowHeight: window.innerHeight,
      debouncedResizeListener: null,
    }
  },
  computed: {
    ...mapState('ephemeral', ['previewedPhoto']),
    isVisible() {
      return !!this.previewedPhoto
    },
    parentWowId() {
      return (this.previewedPhoto || {}).wowId
    },
    showJump() {
      return !!this.parentWowId
    },
  },
  beforeMount() {
    // thanks https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
    this.debouncedResizeListener = debounce(() => {
      this.windowHeight = window.innerHeight
    }, 250)
    window.addEventListener('resize', this.debouncedResizeListener)
  },
  beforeDestroy() {
    if (!this.debouncedResizeListener) {
      return
    }
    window.removeEventListener('resize', this.debouncedResizeListener)
  },
  methods: {
    onDeletePhoto() {
      this.$emit('on-delete', this.previewedPhoto)
    },
    closePhotoPreview() {
      this.$store.commit('ephemeral/closePhotoPreview')
    },
    onJump() {
      this.$emit('jump', this.parentWowId)
    },
  },
}
</script>

<style lang="scss" scoped>
.photo-viewer-image {
  /* we assume the photo is bigger than most screens so it'll fill as we expect */
  max-width: 100vw;
  display: block;
  margin: 0 auto;
}

.photo-viewer-toolbar {
  display: flex;
  position: absolute;
  bottom: 0.25em;
  left: 0;
  right: 0;

  div {
    flex-grow: 1;
  }

  .delete-btn {
    background-color: red;
  }

  .jump-btn {
    background-color: green;
  }
}
</style>
