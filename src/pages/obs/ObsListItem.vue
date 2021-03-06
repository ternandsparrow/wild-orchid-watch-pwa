<template>
  <v-ons-list-item modifier="chevron" @click="push(record)">
    <div class="left">
      <img class="list-item__thumbnail" :src="thumbnailPhoto(record)" />
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
      <span
        v-show="isPossiblyStuck(record)"
        class="list-item__subtitle warn-indicator"
      >
        <v-ons-icon icon="fa-exclamation-triangle"></v-ons-icon>
        Possible problem</span
      >
      <div class="obs-badges">
        <img
          v-if="record.isWaiting"
          src="@/assets/img/cloud-wait.svg"
          class="wow-icon"
        />
        <span v-if="record.isDraft" class="wow-badge">
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
import * as constants from '@/misc/constants'
import { isObsSystemError, extractGeolocationText } from '@/store/obs'
import {
  humanDateString,
  isPossiblyStuck as isPossiblyStuckHelper,
  wowIdOf,
} from '@/misc/helpers'

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
  methods: {
    thumbnailPhoto(record) {
      const localPhotoUrl = record.thumbnailUrl
      const remotePhotoUrl = ((record.photos || [])[0] || {}).url
      return localPhotoUrl || remotePhotoUrl || constants.noImagePlaceholderUrl
    },
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
    isPossiblyStuck(record) {
      return isPossiblyStuckHelper(this.$store, record)
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

.warn-indicator {
  color: $wowWarnOrange;
}
</style>
