<template>
  <v-ons-page>
    <custom-toolbar back-label="Home" title="Missions" />
    <v-ons-pull-hook
      :action="doRefresh"
      @changestate="pullHookState = $event.state"
    >
      <span v-show="pullHookState === 'initial'"> Pull to refresh </span>
      <span v-show="pullHookState === 'preaction'"> Release </span>
      <span v-show="pullHookState === 'action'"> Loading... </span>
    </v-ons-pull-hook>
    <div v-if="isNoRecords" class="no-records-msg">
      There are no missions available right now
    </div>
    <v-ons-list v-if="!isNoRecords">
      <v-ons-list-item
        v-for="curr in availableMissions"
        :key="curr.id"
        @click="push(curr.id)"
      >
        <div class="center">
          <span class="list-item__title item-header">{{ curr.name }}</span>
          <div>Timeline: {{ getTimelineString(curr) }}</div>
          <div>The goal:<br />{{ truncateGoal(curr.goal) }}</div>
        </div>
      </v-ons-list-item>
    </v-ons-list>
    <v-ons-fab position="bottom right" @click="onNew">
      <v-ons-icon icon="md-plus"></v-ons-icon>
    </v-ons-fab>
  </v-ons-page>
</template>

<script>
import moment from 'moment'
import { mapState, mapGetters } from 'vuex'

export default {
  data() {
    return {
      pullHookState: 'initial',
    }
  },
  computed: {
    ...mapState('missions', ['availableMissions']),
    ...mapState('ephemeral', ['networkOnLine']),
    ...mapGetters('auth', ['isUserLoggedIn']),
    isNoRecords() {
      return !this.availableMissions || this.availableMissions.length === 0
    },
  },
  created() {
    this.$store.dispatch('missions/getAvailableMissions')
  },
  mounted() {
    this.doRefresh()
  },
  methods: {
    push(missionId) {
      // FIXME navigate to event detail page
      this.$ons.notification.alert('FIXME - implement this')
      console.debug(missionId)
    },
    onNew() {
      this.$router.push({ name: 'MissionsNew' })
    },
    doRefresh(done) {
      if (!this.networkOnLine) {
        this.$ons.notification.toast('Cannot refresh while offline', {
          timeout: 3000,
          animation: 'fall',
        })
      } else if (this.isUserLoggedIn) {
        this.$store.dispatch('missions/getAvailableMissions')
      }
      done && done()
    },
    getTimelineString(record) {
      const duration = moment.duration(
        moment(record.endDate).diff(moment(record.startDate)),
      )
      return `${record.startDate} until ${
        record.endDate
      } (${duration.asDays()} days)`
    },
    truncateGoal(goal) {
      return goal.length > 150 ? goal.substring(0, 150) + '...' : goal
    },
  },
}
</script>

<style scoped lang="scss">
.item-header {
  font-size: 1.6em;
  margin-bottom: 0.4em;
  line-height: 1.2em;
}
</style>
