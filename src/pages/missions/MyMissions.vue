<template>
  <v-ons-page>
    <div v-if="isNoRecords" class="no-records-msg">Nothing to see here</div>
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
          <span class="list-item__subtitle">
            <strong>{{ curr.user }} </strong>
            <span>{{ curr.action }}</span>
          </span>
          <span class="list-item__subtitle">{{ curr.timeStr }}</span>
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
      return !this.availableMissions || this.availableMissions.length === 0
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

<style scoped>
.no-records-msg {
  color: #666;
  text-align: center;
  line-height: 3em;
}
</style>
