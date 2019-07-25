<template>
  <v-ons-page>
    <no-records-msg v-show="isNoRecords" />
    <v-ons-list v-show="!isNoRecords">
      <v-ons-list-item
        v-for="curr in mySpecies"
        :key="curr.id"
        @click="push(curr.id)"
      >
        <div class="left">
          <img class="list-item__thumbnail" :src="defaultPhoto(curr)" />
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
import { mapState, mapGetters } from 'vuex'
import { noImagePlaceholderUrl } from '@/misc/constants'

export default {
  computed: {
    ...mapState('obs', ['mySpecies']),
    ...mapGetters('auth', ['isUserLoggedIn']),
    isNoRecords() {
      return !this.mySpecies || this.mySpecies.length === 0
    },
  },
  mounted() {
    if (this.isUserLoggedIn) {
      this.$store.dispatch('obs/getMySpecies')
    }
  },
  methods: {
    push(speciesId) {
      // FIXME navigate to species detail page
      this.$ons.notification.alert('FIXME - implement this')
      console.debug(speciesId)
    },
    defaultPhoto(record) {
      if (!record || !record.defaultPhoto) {
        return noImagePlaceholderUrl
      }
      return record.defaultPhoto.square_url
    },
  },
}
</script>
