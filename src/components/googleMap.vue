<template>
  <div>
    <div v-if="networkOnLine">
      <gmap-map
        :center="center"
        :zoom="mapZoom"
        class="wow-gmap"
        :options="mapOptions"
      >
        <gmap-marker
          :position="markerPosition"
          @click="center = markerPosition"
        ></gmap-marker>
      </gmap-map>
    </div>
    <div v-if="!networkOnLine" class="offline-map">
      You are offline, cannot show map.
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  name: 'GoogleMap',
  props: {
    markerPosition: {
      type: Object /* {lat: Number, lng: Number} */,
      required: true,
    },
  },
  data() {
    return {
      // default to Montreal to avoid null object warnings
      center: { lat: 45.508, lng: -73.587 },
      markers: [],
      mapZoom: 16,
      mapOptions: {
        gestureHandling: 'cooperative',
      },
    }
  },
  watch: {
    markerPosition() {
      this.centerPosition()
    },
  },
  computed: {
    ...mapState('ephemeral', ['networkOnLine']),
  },
  mounted() {
    this.centerPosition()
  },
  methods: {
    centerPosition() {
      this.center = {
        lat: this.markerPosition.lat,
        lng: this.markerPosition.lng,
      }
    },
  },
}
</script>

<style scoped>
.wow-gmap {
  width: 100%;
  height: 400px;
}

.offline-map {
  padding: 4em 0;
  text-align: center;
  border: 1px solid #777;
  border-radius: 10px;
  margin-top: 1em;
  background-color: #eee;
  color: #333;
}
</style>
