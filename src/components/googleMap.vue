<template>
  <div>
    <gmap-map
      :center="center"
      :zoom="mapZoom"
      style="width:100%;  height: 400px;"
    >
      <gmap-marker
        :key="index"
        v-for="(m, index) in markers"
        :position="m.position"
        @click="center=m.position"
      ></gmap-marker>
    </gmap-map>
  </div>
</template>

<script>
export default {
  name: "GoogleMap",
  props: ["markerPosition"],
  data() {
    return {
      // default to Montreal to avoid null object warnings
      center: { lat: 45.508, lng: -73.587 },
      markers: [],
      // you can adjust the zoom here
      mapZoom: 16
    };
  },

  mounted() {
      // adding marker using the position passed to the component
    this.markers.push({
        position : this.markerPosition
    })
    // centering the map
    this.centerPosition();
  },

  methods: {
    centerPosition: function() {
        this.center = {
          lat: this.markerPosition.lat,
          lng: this.markerPosition.lng
        };
    }
  }
};
</script>