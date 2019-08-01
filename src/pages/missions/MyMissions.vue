<template>
  <v-ons-page>
    <no-records-msg v-if="isNoRecords" />
    <v-ons-list v-if="!isNoRecords">
      <v-ons-list-item
        v-for="curr in myMissions"
        :key="curr.id"
        @click="push(curr.id)"
      >
        <div class="left">
          <img class="list-item__thumbnail" :src="firstPhoto(curr)" />
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
import { noImagePlaceholderUrl } from '@/misc/constants'

export default {
  computed: {
    ...mapState('missions', ['myMissions']),
    isNoRecords() {
      return !this.myMissions || this.myMissions.length === 0
    },
  },
  created() {
    this.$store.dispatch('missions/getMyMissions')
  },
  methods: {
    push(missionId) {
      // FIXME implement this
      this.$ons.notification.alert('FIXME - implement this')
      console.debug(missionId)
    },
    isPhoto(record) {
      return record && record.photoUrl
    },
    firstPhoto(record) {
      if (!this.isPhoto(record)) {
        return noImagePlaceholderUrl
      }
      return record.photoUrl
    },
  },
}
</script>
