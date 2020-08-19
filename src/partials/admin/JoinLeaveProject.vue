<template>
  <v-ons-card>
    <div class="title">
      Project joining/leaving test
    </div>
    <p class="text-center">
      <span v-if="isJoinedProject" class="success-alert"
        >You are in the project</span
      >
      <span v-else class="warning-alert"
        >You are <strong>NOT</strong> in the project</span
      >
    </p>
    <p class="text-center">
      We automatically refresh the status after a join/leave, but if you do two
      actions rapidly, sometimes the system hasn't caught up yet. This will
      trigger another refresh.<br />
      <v-ons-button name="join-leave-project-refresh" @click="doRefresh"
        >Refresh project info</v-ons-button
      >
    </p>
    <hr />
    <p>
      Joins the WOW project. We don't pass any args but the default seems to be
      to share coords with curators which is what we want.
    </p>
    <div class="text-center">
      <v-ons-button name="join-project" @click="joinProject"
        >Join project</v-ons-button
      >
    </div>
    <div>
      Result =
      <pre><code>{{joinResult}}</code></pre>
    </div>
    <hr />
    <p>
      Leave the WOW project. <strong>BEWARE</strong> doing this will eject all
      your observations from the project, which probably isn't what you want.
    </p>
    <div class="text-center">
      <v-ons-button name="leave-project" @click="leaveProject"
        >Leave project</v-ons-button
      >
    </div>
    <div>
      Result =
      <pre><code>{{leaveResult}}</code></pre>
    </div>
  </v-ons-card>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'JoinLeaveProject',
  data() {
    return {
      joinResult: '(not yet run)',
      leaveResult: '(not yet run)',
    }
  },
  computed: {
    ...mapGetters(['isJoinedProject']),
  },
  methods: {
    async joinProject() {
      try {
        this.joinResult = 'processing...'
        await this.$store.dispatch('obs/waitForProjectInfo')
        const projectId = this.$store.getters['obs/projectId']
        const resp = await this.$store.dispatch('doApiPost', {
          urlSuffix: `/projects/${projectId}/join`,
        })
        console.debug('Successfully joined project', resp)
        this.joinResult = JSON.stringify(resp, null, 2)
        this.$emit('refresh')
      } catch (err) {
        console.error('Failed to join project', err)
        this.joinResult = 'ERROR: ' + err.message
      }
    },
    async leaveProject() {
      try {
        this.leaveResult = 'processing...'
        await this.$store.dispatch('obs/waitForProjectInfo')
        const projectId = this.$store.getters['obs/projectId']
        const resp = await this.$store.dispatch('doApiDelete', {
          urlSuffix: `/projects/${projectId}/leave`,
        })
        console.debug('Successfully left project', resp)
        this.leaveResult = 'success' // there is no resp body
        this.$emit('refresh')
      } catch (err) {
        console.error('Failed to leave project', err)
        this.leaveResult = 'ERROR: ' + err.message
      }
    },
    doRefresh() {
      this.$emit('refresh')
    },
  },
}
</script>

<style lang="scss" scoped>
.jwk-textarea {
  height: 12em;
  width: 100%;
}
</style>
