<template>
  <div>
    <v-ons-list-item
      v-for="curr in records"
      :key="keyPrefix + getId(curr)"
      modifier="chevron"
      @click="onClick(curr)"
    >
      <div class="left">
        <img class="list-item__thumbnail" :src="firstPhoto(curr)" />
      </div>
      <div class="center">
        <span class="list-item__title">{{ speciesGuess(curr) }}</span
        ><span class="list-item__subtitle">{{ placeGuess(curr) }}</span>
        <span class="list-item__subtitle">{{ dateInfo(curr) }}</span>
        <span
          v-show="isSystemError(curr)"
          class="list-item__subtitle error-indicator"
          >Error uploading record</span
        >
        <span
          v-show="isPossiblyStuck(curr)"
          class="list-item__subtitle warn-indicator"
        >
          <v-ons-icon icon="fa-exclamation-triangle"></v-ons-icon>
          Possible problem</span
        >
      </div>
    </v-ons-list-item>
  </div>
</template>

<script>
import { noImagePlaceholderUrl } from '@/misc/constants'
import { isObsSystemError, extractGeolocationText } from '@/store/obs'
import { humanDateString, isPossiblyStuck, wowIdOf } from '@/misc/helpers'

export default {
  name: 'ObsList',
  props: {
    records: Array,
    keyPrefix: {
      type: String,
      default: '',
    },
  },
  methods: {
    onClick(clickedRecord) {
      const clickedId = wowIdOf(clickedRecord)
      this.$emit('item-click', clickedId)
    },
    getId(record) {
      return wowIdOf(record)
    },
    firstPhoto(record) {
      if (!record || !record.photos || !record.photos.length) {
        return noImagePlaceholderUrl
      }
      return record.photos[0].url
    },
    speciesGuess(record) {
      return record.speciesGuess || '(No species name)'
    },
    placeGuess(record) {
      return extractGeolocationText(record)
    },
    isSystemError(record) {
      return isObsSystemError(record)
    },
    dateInfo(r) {
      return humanDateString(r.observedAt)
    },
    isPossiblyStuck(record) {
      return isPossiblyStuck(this.$store, record)
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
