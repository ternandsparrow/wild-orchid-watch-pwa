<template>
  <v-ons-page>
    <no-records-msg v-if="isNoRecords" />
    <v-ons-list v-if="!isNoRecords">
      <v-ons-list-item
        v-for="curr in mySpecies"
        :key="curr.id"
        @click="push(curr.id)"
      >
        <div class="left">
          <img
            class="list-item__thumbnail"
            :src="curr.defaultPhoto.square_url"
          />
        </div>
        <div class="center">
          <span class="list-item__title">{{ curr.commonName }}</span
          ><span class="list-item__subtitle">{{ curr.scientificName }}</span>
        </div>
      </v-ons-list-item>
    </v-ons-list>
    <!-- FIXME do we want a "More species" button like iNat? -->
  </v-ons-page>
</template>

<script>
import { mapState } from 'vuex'

export default {
  computed: {
    ...mapState('obs', ['mySpecies']),
    isNoRecords() {
      return !this.mySpecies || this.mySpecies.length === 0
    },
  },
  created() {
    this.$store.dispatch('obs/getMySpecies')
  },
  methods: {
    push(speciesId) {
      // FIXME navigate to species detail page
      this.$ons.notification.alert('FIXME - implement this')
      console.debug(speciesId)
    },
  },
}
</script>
