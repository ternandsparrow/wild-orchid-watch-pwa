<template>
  <v-ons-page>
    <custom-toolbar cancellable :title="title" @cancelled="onCancel">
      <template v-slot:right>
        <v-ons-toolbar-button name="toolbar-save-btn" @click="onSave"
          >Save</v-ons-toolbar-button
        >
      </template>
    </custom-toolbar>
    <v-ons-list>
      <wow-header label="Mission name" />
      <v-ons-list-item modifier="nodivider">
        <v-ons-input
          v-model="missionName"
          float
          placeholder="Input value"
          type="text"
        >
        </v-ons-input>
      </v-ons-list-item>
      <wow-header label="End date" />
      <v-ons-list-item>
        <input
          v-model="endDate"
          type="date"
          :min="tomorrow"
          :max="oneYearInFuture"
        />
        <div class="wow-obs-field-desc">
          Last day people can participate in the mission
        </div>
      </v-ons-list-item>
      <wow-header label="Goal" />
      <v-ons-list-item>
        <textarea v-model="goal" class="wow-textarea"> </textarea>
        <div class="wow-obs-field-desc">
          What should participants be trying to achieve?
        </div>
      </v-ons-list-item>
    </v-ons-list>
    <div class="footer-whitespace"></div>
    <v-ons-alert-dialog
      modifier="rowfooter"
      :visible.sync="formErrorDialogVisible"
    >
      <div slot="title">Invalid value(s) entered</div>
      <p>Please correct the invalid values and try again.</p>
      <ul class="error-msg-list">
        <li v-for="curr of formErrorMsgs" :key="curr">{{ curr }}</li>
      </ul>
      <template slot="footer">
        <v-ons-alert-dialog-button @click="onDismissFormError"
          >Ok</v-ons-alert-dialog-button
        >
      </template>
    </v-ons-alert-dialog>
  </v-ons-page>
</template>

<script>
import dayjs from 'dayjs'
import { encodeMissionBody } from '@/misc/helpers'

export default {
  name: 'MissionsNew',
  data() {
    const tomorrow = dayjs()
      .add(1, 'days')
      .format('YYYY-MM-DD')
    return {
      missionName: null,
      goal: null,
      formErrorDialogVisible: false,
      formErrorMsgs: [],
      endDate: tomorrow,
      tomorrow,
      oneYearInFuture: dayjs()
        .add(1, 'years')
        .format('YYYY-MM-DD'),
    }
  },
  computed: {
    isEdit() {
      return this.$route.matched.some(record => record.meta.isEdit)
    },
    title() {
      return this.isEdit ? 'Edit mission' : 'New mission'
    },
    targetMissionId() {
      return parseInt(this.$route.params.id)
    },
  },
  mounted() {
    if (!this.isEdit) {
      return
    }
    const found = this.$store.state.missions.availableMissions.find(
      e => e.id === this.targetMissionId,
    )
    if (!found) {
      console.warn(
        `Could not find mission with ID='${this.targetMissionId}' to edit`,
      )
      return
    }
    this.missionName = found.name
    // FIXME do we need to disable editing for past missions or force edited
    // missions to still have an endDate in the future (from now)?
    this.endDate = found.endDate
    this.goal = found.goal
  },
  methods: {
    async onSave() {
      const myUserId = this.$store.getters.myUserId
      const projectId = (this.$store.state.obs.projectInfo || {}).id
      if (!projectId) {
        throw new Error('No project info available, cannot continue')
      }
      const { handler, urlSuffix } = (() => {
        if (this.isEdit) {
          return {
            handler: 'doApiPut',
            urlSuffix: `/posts/${this.targetMissionId}`,
          }
        }
        return { handler: 'doApiPost', urlSuffix: '/posts' }
      })()
      this.$ons.notification.toast('Saving...', {
        timeout: 3000,
        animation: 'ascend',
      })
      await this.$store.dispatch(
        handler,
        {
          urlSuffix,
          data: {
            commit: 'Publish',
            post: {
              title: this.missionName,
              body: encodeMissionBody(
                this.missionName,
                this.endDate,
                this.goal,
              ),
              preferred_formatting: 'simple',
              user_id: myUserId,
              parent_id: projectId,
              parent_type: 'Project',
            },
          },
        },
        { root: true },
      )
      this.$ons.notification.toast('Mission uploaded to server', {
        timeout: 3000,
        animation: 'ascend',
      })
      this.$router.push({ name: 'Missions' })
    },
    onDismissFormError() {
      this.formErrorDialogVisible = false
    },
    onCancel() {
      this.$router.push({ name: 'Missions' })
    },
  },
}
</script>

<style scoped lang="scss">
.wow-obs-field-desc {
  color: #888;
  font-size: 0.7em;
  margin-top: 0.5em;
  width: 100%;
}

.wow-textarea {
  padding: 12px 16px 14px;
  border-radius: 4px;
  width: 80%;
  height: 5em;
}

.required {
  color: red;
}

.footer-whitespace {
  height: 50vh;
}

.error-msg-list {
  text-align: left;
}
</style>
