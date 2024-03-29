<template>
  <menu-wrapper title="Missions">
    <v-ons-pull-hook
      :action="doRefresh"
      @changestate="pullHookState = $event.state"
    >
      <span v-show="pullHookState === 'initial'"> Pull to refresh </span>
      <span v-show="pullHookState === 'preaction'"> Release </span>
      <span v-show="pullHookState === 'action'"> Loading... </span>
    </v-ons-pull-hook>
    <no-records-msg
      v-if="isNoRecords"
      fragment="There are no missions available"
    />
    <div v-if="isMissionAdmin" class="admin-info-msg">
      <v-ons-icon icon="fa-info-circle"></v-ons-icon>
      You are a project admin, so you can create, edit and delete missions.
    </div>
    <v-ons-list v-show="!isNoRecords">
      <v-ons-list-item v-for="curr in displayableMissions" :key="curr.id">
        <div>
          <span class="list-item__title item-header">{{ curr.name }}</span>
          <div v-if="isMissionAdmin">
            <v-ons-button
              name="mission-delete-btn"
              modifier="outline"
              @click="onDelete(curr.id)"
              >Delete</v-ons-button
            >
            <v-ons-button
              name="mission-edit-btn"
              modifier="outline"
              @click="onEdit(curr.id)"
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
  </menu-wrapper>
</template>

<script>
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import { mapState, mapGetters } from 'vuex'

dayjs.extend(duration)

export default {
  name: 'MissionsAvailable',
  data() {
    return {
      pullHookState: 'initial',
      deletedMissionIds: [],
      availableMissions: [],
    }
  },
  computed: {
    ...mapState('ephemeral', ['networkOnLine']),
    ...mapGetters('auth', ['isUserLoggedIn']),
    displayableMissions() {
      // we want the delete to update the UI immediately, even though the HTTP
      // call and server indexing takes a few seconds
      return this.availableMissions.filter(
        (e) => !this.deletedMissionIds.includes(e.id),
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
        (e) => e.user_id === this.$store.getters['auth/myUserId'],
      )
    },
  },
  mounted() {
    this.$store.dispatch('obs/getProjectInfo')
    this.doRefresh()
  },
  methods: {
    onNew() {
      this.$router.push({ name: 'MissionsNew' })
    },
    async doRefresh(done) {
      if (!this.networkOnLine) {
        this.$ons.notification.toast('Cannot refresh while offline', {
          timeout: 3000,
          animation: 'fall',
        })
      } else if (this.isUserLoggedIn) {
        const missions = await this.$store.dispatch(
          'missionsAndNews/getAvailableMissions',
        )
        this.availableMissions = missions
      }
      if (done) {
        done()
      }
    },
    getTimelineString(record) {
      const theDuration = dayjs.duration(
        dayjs(record.endDate).diff(dayjs(record.startDate)),
      )
      return `${record.startDate} until ${
        record.endDate
      } (${theDuration.asDays()} days)`
    },
    truncateGoal(goal) {
      return (goal || '').length > 150 ? `${goal.substring(0, 150)}...` : goal
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
      await this.$store.dispatch('missionsAndNews/deleteMission', missionId)
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
