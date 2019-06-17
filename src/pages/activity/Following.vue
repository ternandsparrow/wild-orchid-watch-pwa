<template>
  <v-ons-page>
    <div v-if="isNoRecords" class="no-records-msg">Nothing to see here</div>
    <v-ons-list v-if="!isNoRecords">
      <v-ons-list-item
        v-for="curr in followingEvents"
        :key="curr.id"
        @click="push(curr.id)"
      >
        <div class="left">
          <img
            class="list-item__thumbnail"
            :src="curr.defaultPhoto.square_url"
          />
        </div>
        <div class="center">
          <!-- FIXME update fields -->
          <span class="list-item__title">{{ curr.commonName }}</span
          ><span class="list-item__subtitle">{{ curr.scientificName }}</span>
        </div>
      </v-ons-list-item>
    </v-ons-list>
  </v-ons-page>
</template>

<script>
import { mapState } from 'vuex'

export default {
  computed: {
    ...mapState('activity', ['followingEvents']),
    isNoRecords() {
      return !this.followingEvents || this.followingEvents.length === 0
    },
  },
  created() {
    this.$store.dispatch('activity/getFollowingEvents')
  },
  methods: {
    push(eventId) {
      // FIXME navigate to event detail page
      this.$ons.notification.alert('FIXME - implement this')
      console.debug(eventId)
    },
  },
}
</script>

<style scoped>
.no-records-msg {
  color: #666;
  text-align: center;
  line-height: 3em;
}
</style>
