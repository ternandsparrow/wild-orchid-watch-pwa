<template>
  <v-ons-page>
    <no-records-msg v-if="isNoRecords" />
    <v-ons-list v-if="!isNoRecords">
      <v-ons-list-item
        v-for="curr in availableMissions"
        :key="curr.id"
        @click="push(curr.id)"
      >
        <div class="left">
          <img class="list-item__thumbnail" :src="curr.photoUrl" />
        </div>
        <div class="center">
          <!-- FIXME update fields -->
          <span class="list-item__title"
            >Target Species: {{ curr.targetSpecies }}</span
          >
          <span class="list-item__title"
            >Target Observation Count: {{ curr.targetObservationCount }}</span
          >
          <!-- span class="list-item__subtitle">{{ curr.searchLocation }}</span -->
          <img style="width: 100%" src="@/assets/img/no-image-map.png" />
        </div>
      </v-ons-list-item>
    </v-ons-list>
  </v-ons-page>
</template>

<script>
import { mapState } from 'vuex'

export default {
  computed: {
    ...mapState('missions', ['availableMissions']),
    isNoRecords() {
      return !this.availableMissions || this.availableMissions.length === 0
    },
  },
  created() {
    this.$store.dispatch('missions/getAvailableMissions')
  },
  methods: {
    push(missionId) {
      // FIXME navigate to event detail page
      this.$ons.notification.alert('FIXME - implement this')
      console.debug(missionId)
    },
  },
}
</script>
