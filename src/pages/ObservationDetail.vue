<template>
  <v-ons-page>
    <custom-toolbar
      back-label="Home"
      :title="nullSafeObs.speciesGuess"
    ></custom-toolbar>

    <v-ons-card>
      <!-- FIXME add all photos as carousel -->
      <img :src="firstPhoto" alt="FIXME add alt" style="width: 100%" />
      <div class="title">{{ nullSafeObs.title }}</div>
      <div class="content">
        <v-ons-list>
          <v-ons-list-header>Details</v-ons-list-header>
          <v-ons-list-item>{{ nullSafeObs.placeGuess }}</v-ons-list-item>
          <!-- FIXME get meta fields for our app -->
        </v-ons-list>
      </div>
    </v-ons-card>
  </v-ons-page>
</template>

<script>
import { mapGetters } from 'vuex'
import { noImagePlaceholderUrl } from '@/misc/constants'

export default {
  data() {
    return {}
  },
  computed: {
    ...mapGetters('obs', ['observationDetail']),
    nullSafeObs() {
      // FIXME is this a code smell?
      return this.observationDetail || {}
    },
    firstPhoto() {
      if (
        !this.nullSafeObs ||
        !this.nullSafeObs.obsPhotos ||
        !this.nullSafeObs.obsPhotos.length
      ) {
        return noImagePlaceholderUrl
      }
      const squareUrl = this.nullSafeObs.obsPhotos[0].photo.url
      return squareUrl.replace('square', 'medium')
    },
  },
}
</script>
