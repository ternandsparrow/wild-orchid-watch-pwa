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
        <div>
          <v-ons-button
            ><v-ons-icon icon="ion-thumbsup"></v-ons-icon
          ></v-ons-button>
          <v-ons-button
            ><v-ons-icon icon="ion-share"></v-ons-icon
          ></v-ons-button>
        </div>
        <v-ons-list>
          <v-ons-list-header>Details</v-ons-list-header>
          <v-ons-list-item>{{ nullSafeObs.placeGuess }}</v-ons-list-item>
          <v-ons-list-item>FIXME</v-ons-list-item>
          <v-ons-list-item>TODO</v-ons-list-item>
        </v-ons-list>
      </div>
    </v-ons-card>
  </v-ons-page>
</template>

<script>
import {mapGetters} from 'vuex'

export default {
  data() {
    return {
      spdOpen: false,
      shareItems: {
        Twitter: 'md-twitter',
        Facebook: 'md-facebook',
        'Google+': 'md-google-plus',
      },
    }
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
        return '../assets/no-image-placeholder.png'
      }
      const squareUrl = this.nullSafeObs.obsPhotos[0].photo.url
      return squareUrl.replace('square', 'medium')
    },
  },
}
</script>
