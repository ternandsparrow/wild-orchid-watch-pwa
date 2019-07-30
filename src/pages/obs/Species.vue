<template>
  <v-ons-page>
    <v-ons-pull-hook
      :action="doRefresh"
      @changestate="pullHookState = $event.state"
    >
      <span v-show="pullHookState === 'initial'"> Pull to refresh </span>
      <span v-show="pullHookState === 'preaction'"> Release </span>
      <span v-show="pullHookState === 'action'"> Loading... </span>
    </v-ons-pull-hook>
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
  data() {
    return {
      pullHookState: 'initial',
    }
  },
  computed: {
    ...mapState('obs', ['mySpecies']),
    ...mapGetters('obs', ['isMySpeciesStale']),
    ...mapGetters('auth', ['isUserLoggedIn']),
    isNoRecords() {
      return !this.mySpecies || this.mySpecies.length === 0
    },
  },
  mounted() {
    if (this.isMySpeciesStale) {
      this.doRefresh()
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
    async doRefresh(done) {
      if (this.isUserLoggedIn) {
        // FIXME need to cache-bust (user agent disk cache) for this and similar
        await this.$store.dispatch('obs/getMySpecies')
      }
      done && done()
    },
  },
}
</script>
