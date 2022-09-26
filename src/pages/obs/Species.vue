<template>
  <menu-wrapper title="My Species">
    <v-ons-pull-hook
      :action="doRefresh"
      @changestate="pullHookState = $event.state"
    >
      <span v-show="pullHookState === 'initial'"> Pull to refresh </span>
      <span v-show="pullHookState === 'preaction'"> Release </span>
      <span v-show="pullHookState === 'action'"> Loading... </span>
    </v-ons-pull-hook>
    <no-records-msg
      v-if="isNoRecords"
      fragment="You have no identified species"
    />
    <v-ons-list v-if="!isNoRecords">
      <v-ons-list-item v-for="curr in tidyMySpecies" :key="curr.id" expandable>
        <div class="left">
          <img class="list-item__thumbnail" :src="defaultPhoto(curr)" />
        </div>
        <div class="center">
          <span class="list-item__title"
            ><a>{{ curr.commonName }}</a></span
          ><span class="list-item__subtitle">{{ curr.scientificName }}</span>
        </div>
        <div class="right">{{ curr.observationCount }}</div>
        <div class="expandable-content">
          <div>
            <a :href="makeLinkToInat(curr)" target="_blank">
              View taxonomy record on iNaturalist
            </a>
          </div>
          <!-- TODO add link to taxon info page (and build that page) -->
        </div>
      </v-ons-list-item>
    </v-ons-list>
    <!-- TODO do we want a "More species" button like iNat? -->
  </menu-wrapper>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import { inatUrlBase, noImagePlaceholderUrl } from '@/misc/constants'

export default {
  name: 'SpeciesList',
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
      return (this.tidyMySpecies || []).length === 0
    },
    tidyMySpecies() {
      return (this.mySpecies || [])
        .map((e) => ({
          ...e,
          commonName: e.commonName || e.scientificName,
        }))
        .sort((a, b) => {
          const aName = a.commonName.toLowerCase()
          const bName = b.commonName.toLowerCase()
          if (aName > bName) return 1
          if (aName < bName) return -1
          return 0
        })
    },
  },
  mounted() {
    if (this.isMySpeciesStale) {
      this.doRefresh()
    }
  },
  methods: {
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
      if (done) {
        done()
      }
    },
    makeLinkToInat(record) {
      return `${inatUrlBase}/taxa/${record.id}`
    },
  },
}
</script>
