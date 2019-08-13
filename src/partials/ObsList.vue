<template>
  <div>
    <v-ons-list-item
      v-for="curr in records"
      :key="keyPrefix + curr.inatId"
      modifier="chevron"
      @click="onClick(curr.inatId)"
    >
      <div class="left">
        <img class="list-item__thumbnail" :src="firstPhoto(curr)" />
      </div>
      <div class="center">
        <span class="list-item__title">{{ speciesGuess(curr) }}</span
        ><span class="list-item__subtitle">{{ placeGuess(curr) }}</span>
      </div>
    </v-ons-list-item>
  </div>
</template>

<script>
import { noImagePlaceholderUrl } from '@/misc/constants'

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
    onClick(clickedId) {
      this.$emit('item-click', clickedId)
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
      const coords =
        record.geojson &&
        record.geojson.coordinates &&
        record.geojson.coordinates
      const coordString = coords && coords[1] + ',' + coords[0]
      return record.placeGuess || coordString || '(No place guess)'
    },
  },
}
</script>
