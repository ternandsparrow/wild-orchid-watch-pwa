<template>
  <v-ons-card>
    <div class="title">
      Force recordProcessingOutcome for obs
    </div>
    <div>
      <v-ons-button @click="prepResetRpoList"
        >1. Get list of local obs</v-ons-button
      >
    </div>
    <div>
      Obs to edit
      <select v-model="setRpoSelectedUuid">
        <option
          v-for="curr of setRpoAvailableUuids"
          :key="curr.uuid"
          :value="curr.uuid"
          >{{ curr.title }}</option
        >
      </select>
    </div>
    <div>
      Outcome to use
      <select v-model="setRpoSelectedOutcome">
        <option
          v-for="curr of setRpoAvailableOutcomes"
          :key="curr"
          :value="curr"
          >{{ curr }}</option
        >
      </select>
    </div>
    <div>
      <v-ons-button @click="doSetRpo">2. Set outcome</v-ons-button>
    </div>
    <div>Status = {{ setRpoStatus }}</div>
  </v-ons-card>
</template>

<script>
import * as constants from '@/misc/constants'

export default {
  name: 'ForceRpo',
  data() {
    return {
      setRpoStatus: null,
      setRpoSelectedOutcome: null,
      setRpoAvailableUuids: [],
      setRpoAvailableOutcomes: [
        constants.waitingOutcome,
        constants.withLocalProcessorOutcome,
        constants.withServiceWorkerOutcome,
        constants.successOutcome,
        constants.systemErrorOutcome,
      ],
      setRpoSelectedUuid: null,
    }
  },
  methods: {
    async doSetRpo() {
      this.setRpoStatus = 'starting'
      const anyOutcome = []
      try {
        await this.$store.dispatch('obs/_transitionHelper', {
          wowId: this.setRpoSelectedUuid,
          targetOutcome: this.setRpoSelectedOutcome,
          validFromOutcomes: anyOutcome,
        })
        this.setRpoStatus = 'refreshing'
        await this.$store.dispatch('obs/refreshLocalRecordQueue')
        this.setRpoStatus = 'done'
      } catch (err) {
        console.error('Failed to reset status of obs', err)
        this.setRpoStatus = 'error: ' + err.message
      }
    },
    prepResetRpoList() {
      this.setRpoAvailableUuids = this.$store.getters['obs/localRecords'].map(
        e => ({
          title: `${e.speciesGuess}  ${e.wowMeta.recordProcessingOutcome}  ${e.uuid}  ${e.observedAt}`,
          uuid: e.uuid,
        }),
      )
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
