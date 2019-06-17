<template>
  <v-ons-page @show="onPageShown" @hide="onPageHidden">
    <div class="user-prompt">
      <div>{{ userPromptMsg }}</div>
    </div>
    <div class="cam-container">
      <!-- FIXME handle landscape, or lock to portrait -->
      <!-- FIXME could use a different object-fit css property for the <video> but then display would be clipped -->
      <web-cam
        v-if="isInit"
        ref="webcam"
        :device-id="deviceId"
        width="100%"
        height="100%"
        @cameras="onCameras"
        @camera-change="onCameraChange"
      />
    </div>
    <div class="button-container">
      <v-ons-button modifier="outline" @click="onGallery">
        <v-ons-icon icon="fa-images"></v-ons-icon>
        Gallery
      </v-ons-button>
      <v-ons-button @click="onTakePhoto">
        <v-ons-icon icon="fa-camera"></v-ons-icon>
        Take photo
      </v-ons-button>
      <v-ons-button modifier="outline" @click="onSwapCamera">
        <v-ons-icon icon="md-camera-switch"></v-ons-icon>
        Swap camera
      </v-ons-button>
      <input
        id="photo-gallery-btn"
        ref="gallerybtn"
        type="file"
        name="gallery-photos"
        accept="image/png, image/jpeg"
      />
    </div>
  </v-ons-page>
</template>

<script>
import WebCam from 'vue-web-cam/src/webcam.vue'

export default {
  components: {
    WebCam,
  },
  data() {
    return {
      isInit: false,
      userPromptMsg: 'Take a photo of the plant',
      deviceId: null,
      devices: [],
      img: null,
    }
  },
  computed: {
    deviceIndex() {
      return this.devices.findIndex(e => e.deviceId === this.deviceId)
    },
  },
  watch: {
    devices: function() {
      // Once we have a list select the first one
      // const [first, ..._] = this.devices
      const [first] = this.devices
      if (first) {
        this.deviceId = first.deviceId
      }
    },
  },
  methods: {
    initCamera() {
      if (this.isInit) {
        return
      }
      this.isInit = true
    },
    onPageShown() {
      console.log('show')
      this.initCamera()
      // race condition: ref won't be defined on first run
      this.$refs.webcam && this.$refs.webcam.start()
    },
    onPageHidden() {
      console.log('hidden')
      this.$refs.webcam.stop()
    },
    onCameras(cameras) {
      this.devices = cameras
      console.log('onCameras fired')
    },
    onCameraChange(deviceId) {
      this.deviceId = deviceId
      console.log('On Camera Change Event', deviceId)
    },
    onTakePhoto() {
      this.img = this.$refs.webcam.capture()
    },
    onGallery() {
      // FIXME handle uploaded image
      this.$refs.gallerybtn.click()
    },
    onSwapCamera() {
      const deviceCount = (this.devices || []).length
      if (!deviceCount) {
        console.warning(
          `Cannot swap camera when there are no cameras, deviceCount='${deviceCount}'`,
        )
        return
      }
      const nextDeviceIndex = (this.deviceIndex + 1) % this.devices.length
      this.deviceId = this.devices[nextDeviceIndex].deviceId
    },
  },
}
</script>

<style scoped>
.user-prompt {
  height: 6vh;
  text-align: center;
}

.user-prompt div {
  padding-top: 1em;
}

.cam-container {
  height: 88vh;
}

.button-container {
  height: 6vh;
  display: flex;
}

.button-container ons-button {
  flex-grow: 1;
}

#photo-gallery-btn {
  display: none;
}
</style>
