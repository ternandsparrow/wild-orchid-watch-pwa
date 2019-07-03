<template>
  <div>
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
</template>

<script>
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
</style>
