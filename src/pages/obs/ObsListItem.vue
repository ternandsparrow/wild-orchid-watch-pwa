<template>
  <v-ons-list-item modifier="chevron" @click="push(record)">
    <div class="left">
      <img class="list-item__thumbnail" :src="record.thumbnailUrl" />
    </div>
    <div class="center">
      <span class="list-item__title"
        ><a>{{ speciesGuess(record) }}</a></span
      ><span class="list-item__subtitle">{{ placeGuess(record) }}</span>
      <span class="list-item__subtitle">{{ dateInfo(record) }}</span>
      <span
        v-show="isSystemError(record)"
        class="list-item__subtitle error-indicator"
        >Error uploading record</span
      >
      <div class="obs-badges">
        <span v-if="isBeingProcessedOnServer">
          <img src="@/assets/img/cloud-wait.svg" class="wow-icon" />
          Being processed by server...
        </span>
        <span v-if="isDraft" class="wow-badge">
          <v-ons-icon icon="fa-firstdraft"> </v-ons-icon>
          Draft
        </span>
        <span v-if="record.commentCount" class="wow-badge">
          <v-ons-icon icon="fa-comment"> </v-ons-icon>
          {{ record.commentCount }}
        </span>
        <span v-if="record.idCount" class="wow-badge">
          <v-ons-icon icon="fa-dna"> </v-ons-icon>
          {{ record.idCount }}
        </span>
      </div>
    </div>
  </v-ons-list-item>
</template>

<script>
import { isObsSystemError, extractGeolocationText } from '@/store/obs'
import { humanDateString, wowIdOf } from '@/misc/helpers'
import * as cc from '@/misc/constants'

export default {
  name: 'ObsListItem',
  props: {
    record: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {}
  },
  computed: {
    isWaiting() {
      const val = (this.record.wowMeta || {})[
        cc.recordProcessingOutcomeFieldName
      ]
      return val === cc.waitingOutcome
    },
    isBeingProcessedOnServer() {
      const val = (this.record.wowMeta || {})[
        cc.recordProcessingOutcomeFieldName
      ]
      return val === cc.successOutcome
    },
    isDraft() {
      const val = (this.record.wowMeta || {})[
        cc.recordProcessingOutcomeFieldName
      ]
      return val === cc.draftOutcome
    },
  },
  methods: {
    speciesGuess(record) {
      return record.speciesGuess || '(No species name)'
    },
    placeGuess(record) {
      return extractGeolocationText(record)
    },
    dateInfo(r) {
      return humanDateString(r.observedAt)
    },
    isSystemError(record) {
      return isObsSystemError(record)
    },
    push(record) {
      const obsId = wowIdOf(record)
      this.$router.push({ name: 'ObsDetail', params: { id: obsId } })
    },
  },
}
</script>

<style lang="scss" scoped>
@import '@/theme/variables.scss';
.error-indicator {
  color: red;
}
</style>
