<template>
  <div>
    <div v-if="networkOnLine">
      <!-- Map with a marker stuck to the centre of the view bounds -->
      <gmap-map
        v-if="centeredMarker"
        ref="mapRef"
        :center="center"
        :zoom="mapZoom"
        class="wow-gmap"
        :options="mapOptions"
        :map-type-id="mapTypeId"
        @bounds_changed="updateMarker"
      >
        <gmap-marker
          :position="marker"
          @click="center = markerPosition"
        ></gmap-marker>
      </gmap-map>

      <!-- Marker fixed to the starting position -->
      <gmap-map
        v-else
        ref="mapRef"
        :center="center"
        :zoom="mapZoom"
        class="wow-gmap"
        :options="mapOptions"
        :map-type-id="mapTypeId"
      >
        <gmap-marker
          :position="marker"
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
    mapOptions: {
      type: Object,
      default: function () {
        return { gestureHandling: 'cooperative' }
      },
      required: false,
    },
    mapTypeId: {
      type: String /* 'roadmap', 'satellite', 'hybrid' or 'terrain' */,
      default: 'roadmap',
      required: false,
    },
    centeredMarker: {
      type: Boolean,
      default: false,
      required: false,
    },
  },
  data() {
    return {
      // default to Montreal to avoid null object warnings
      center: { lat: 45.508, lng: -73.587 },
      mapZoom: 16,
      map: null,
      marker: this.markerPosition,
    }
  },
  computed: {
    ...mapState('ephemeral', ['networkOnLine']),
  },
  watch: {
    markerPosition() {
      this.centerPosition()
    },
  },
  mounted() {
    this.centerPosition()
    // Save the map object once it is loaded
    this.$refs.mapRef.$mapPromise.then((map) => {
      this.map = map
    })
  },
  methods: {
    centerPosition() {
      const lat = this.markerPosition.lat
      const lng = this.markerPosition.lng
      if (!lat || !lng) {
        return
      }
      this.center = { lat, lng }
    },
    updateMarker() {
      const bounds = this.map.getBounds()
      const newCenter = {
        lat: (bounds.zb.h + bounds.zb.j) / 2,
        lng: (bounds.Ua.h + bounds.Ua.j) / 2,
      }
      this.marker = newCenter
    },
    onIdle() {
      console.log("map idle")
      /**
      const newCenter = {
        lat: this.map.getCenter().lat(),
        lng: this.map.getCenter().lng()
      }
      $emit('pinDropped', newCenter)
      */
    }
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
