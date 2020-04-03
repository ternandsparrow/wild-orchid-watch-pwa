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
    <div v-if="isMissionAdmin" class="admin-info-msg">
      <v-ons-icon icon="fa-info-circle"></v-ons-icon>
      You are a project admin, so you can create, edit and delete missions.
    </div>
    <v-ons-list v-if="!isNoRecords">
      <v-ons-list-item v-for="curr in displayableMissions" :key="curr.id">
        <div>
          <span class="list-item__title item-header">{{ curr.name }}</span>
          <div v-if="isMissionAdmin">
            <v-ons-button modifier="outline" @click="onDelete(curr.id)"
              >Delete</v-ons-button
            >
            <v-ons-button modifier="outline" @click="onEdit(curr.id)"
              >Edit</v-ons-button
            >
          </div>
          <div>Timeline: {{ getTimelineString(curr) }}</div>
          <div>The goal:<br />{{ truncateGoal(curr.goal) }}</div>
        </div>
      </v-ons-list-item>
    </v-ons-list>
    <v-ons-fab v-if="isMissionAdmin" position="bottom right" @click="onNew">
      <v-ons-icon icon="md-plus"></v-ons-icon>
    </v-ons-fab>
  </v-ons-page>
</template>

<script>
import dayjs from 'dayjs'
import { mapState, mapGetters } from 'vuex'

export default {
  data() {
    return {
      pullHookState: 'initial',
      deletedMissionIds: [],
    }
  },
  computed: {
    ...mapState('missions', ['availableMissions']),
    ...mapState('ephemeral', ['networkOnLine']),
    ...mapGetters('auth', ['isUserLoggedIn']),
    displayableMissions() {
      // we want the delete to update the UI immediately, even though the HTTP
      // call and server indexing takes a few seconds
      return this.availableMissions.filter(
        e => !this.deletedMissionIds.includes(e.id),
      )
    },
    isNoRecords() {
      return !this.availableMissions || this.availableMissions.length === 0
    },
    isMissionAdmin() {
      const pi = this.$store.state.obs.projectInfo
      if (!pi) {
        return false
      }
      return !!pi.admins.find(
        e => e.user_id === this.$store.getters['auth/myUserId'],
      )
    },
  },
  created() {
    this.$store.dispatch('missions/getAvailableMissions')
    this.$store.dispatch('obs/getProjectInfo')
  },
  mounted() {
    this.doRefresh()
  },
  methods: {
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
      const duration = dayjs.duration(
        dayjs(record.endDate).diff(dayjs(record.startDate)),
      )
      return `${record.startDate} until ${
        record.endDate
      } (${duration.asDays()} days)`
    },
    truncateGoal(goal) {
      return (goal || '').length > 150 ? goal.substring(0, 150) + '...' : goal
    },
    async onDelete(missionId) {
      const answer = await this.$ons.notification.confirm(
        'Are you sure about deleting this mission?',
      )
      if (!answer) {
        return
      }
      this.deletedMissionIds.push(missionId)
      this.doRefresh(null)
      await this.$store.dispatch('missions/deleteMission', missionId)
      this.$ons.notification.toast('Record deleted!', {
        timeout: 3000,
        animation: 'ascend',
      })
    },
    onEdit(missionId) {
      this.$router.push({ name: 'MissionsEdit', params: { id: missionId } })
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

.admin-info-msg {
  background-color: #bcddff;
  padding: 1em;
}
</style>
