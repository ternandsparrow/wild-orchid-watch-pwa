<template>
  <div class="page-wrapper">
    <h1 class="home-page-title">New observation</h1>
    <div>Storage stats: {{ storageMsg }}</div>
    <button @click="updateStorageStats">Refresh</button>
    <div class="step">
      <button @click="doNotify">Send test notification</button>
      <button @click="requestNotify">Request notification permission</button>
    </div>
    <div class="step">
      <p>Step 1: mark location</p>
      <button @click="getLocation">Mark location</button>
      <div v-if="isLocSuccess" class="success-msg">
        Successfully mark location (lat={{ lat }}, lng={{ lng }})
      </div>
      <div v-if="locErrorMsg" class="error-msg">{{ locErrorMsg }}</div>
    </div>
    <div class="step">
      <p>Step 2: photos</p>
      <div>
        <label for="photo-camera">Add photo from camera:</label>
        <input
          id="photo-camera"
          type="file"
          accept="image/*"
          capture="camera"
        />
      </div>
      <div>
        <label for="photo-gallery">Add photo from gallery:</label>
        <input id="photo-gallery" type="file" accept="image/*" />
      </div>
      <div>
        <button @click="showCamera">Use VueCamera</button>
        <img :src="photoBlobBase64" class="photo-preview" />
      </div>
    </div>
    <div v-if="isShowCamera" class="camera-thingy">
      <VueCamera capture="photo" @onReady="onCameraDone" />
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import VueCamera from '@mrjeffapp/vuejs-camera'

export default {
  head: {
    title: {
      inner: 'New observation',
    },
    meta: [
      {
        name: 'description',
        content: 'WildOrchidWatch new observation page',
        id: 'desc',
      },
    ],
  },
  components: {
    VueCamera,
  },
  data() {
    return {
      lat: null,
      lng: null,
      locErrorMsg: null,
      isShowCamera: false,
      photoBlobBase64: '',
      storageQuota: 0,
      storageUsage: 0,
    }
  },
  computed: {
    ...mapState('app', ['appTitle']),
    isLocSuccess() {
      return this.lat && this.lng && !this.locErrorMsg
    },
    storageMsg() {
      const quotaMb = this.storageQuota / 1000 / 1000
      const usageMb = this.storageUsage / 1000 / 1000
      const usedPercentRaw = (this.storageUsage / this.storageQuota) * 100
      const usedPercent = isNaN(usedPercentRaw) ? 0 : usedPercentRaw
      return `Used ${usageMb}MB of ${quotaMb}MB (${
        this.storageQuota
      } bytes) (${usedPercent}%)`
    },
  },
  created() {
    this.updateStorageStats()
  },
  methods: {
    getLocation() {
      this.locErrorMsg = null
      if (!navigator.geolocation) {
        this.locErrorMsg = 'Cannot get access to your location'
        return
      }
      navigator.geolocation.getCurrentPosition(loc => {
        this.lat = loc.coords.latitude
        this.lng = loc.coords.longitude
      })
    },
    showCamera() {
      console.log('showing camera')
      this.isShowCamera = true
    },
    onCameraDone(blob) {
      this.isShowCamera = false
      const fr = new FileReader()
      fr.onload = () => {
        this.photoBlobBase64 = fr.result
      }
      fr.readAsDataURL(blob)
    },
    async updateStorageStats() {
      const estimate = await navigator.storage.estimate()
      this.storageQuota = estimate.quota
      this.storageUsage = estimate.usage
    },
    async requestNotify() {
      const resp = await Notification.requestPermission()
      console.log(resp)
    },
    doNotify() {
      const n = new Notification('Some title', { body: 'some body text' })
      n.addEventListener('error', e => {
        console.error('problem when trying to show notification', e)
      })
      n.addEventListener('click', e => {
        console.log('user clicked on notification', e)
      })
    },
  },
}
</script>

<style lang="scss" scoped>
@import '@/theme/variables.scss';

.success-msg {
  color: green;
}

.error-msg {
  color: red;
}

.step {
  border: 1px solid #333;
  border-radius: 10px;
  margin-top: 1em;
  padding: 1em;
}

.camera-thingy {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99;
  background: black;
}

.photo-preview {
  max-width: 50px;
  max-height: 50px;
}
</style>
