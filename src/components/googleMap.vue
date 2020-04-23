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
          v-for="(m, index) in markers"
          :key="index"
          :position="m.position"
          @click="center = m.position"
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
    markerPosition: Object,
  },
  data() {
    return {
      // default to Montreal to avoid null object warnings
      center: { lat: 45.508, lng: -73.587 },
      markers: [],
      // you can adjust the zoom here
      mapZoom: 16,
      mapOptions: {
        gestureHandling: 'cooperative',
      },
    }
  },
  computed: {
    ...mapState('ephemeral', ['networkOnLine']),
  },
  mounted() {
    // adding marker using the position passed to the component
    this.markers.push({
      position: this.markerPosition,
    })
    // centering the map
    this.centerPosition()
  },
  methods: {
    centerPosition: function() {
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
