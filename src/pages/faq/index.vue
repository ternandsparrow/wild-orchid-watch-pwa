<template>
  <v-ons-page>
    <v-ons-list>
      <v-ons-list-header>
        <div>
          <div>
            <v-ons-icon icon="fa-wrench" class="list-item__icon"></v-ons-icon>
          </div>
          <div>
            [WIP] - This page will contain a FAQ as we collect them...!
          </div>
        </div>
      </v-ons-list-header>

      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#1]: Do I need to be super-accurate on all the questions you are
            asking?</span
          ><span class="list-item__subtitle">Well, it goes like this...</span>
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#2]: Who will make definitive Identifications of the orchids that
            are sighted?</span
          ><span class="list-item__subtitle">Well, it goes like this...</span>
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#3]: What should I use for a field name if I don't really
            know??</span
          ><span class="list-item__subtitle">Well, it goes like this...</span>
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#4]: Do I need to take all of the photos?</span
          ><span class="list-item__subtitle">Well, it goes like this...</span>
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#5]: If something goes wrong in the app, how do I report it?</span
          ><span class="list-item__subtitle">Well, it goes like this...</span>
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#6]: Will the app use up all my data and phone storage?</span
          ><span class="list-item__subtitle">Well, it goes like this...</span>
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#7]: Will the pictures I take be stored on my phone also, for
            me?</span
          ><span class="list-item__subtitle">Well, it goes like this...</span>
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#8]: Can I use an external camera to take the photos and the app
            to submit them?</span
          ><span class="list-item__subtitle">Well, it goes like this...</span>
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#9]: Can I submit a sighting using photos that I took
            before?</span
          ><span class="list-item__subtitle">Well, it goes like this...</span>
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#10]: Will the orchids be "safe" when I make sightings with their
            location?</span
          ><span class="list-item__subtitle">Well, it goes like this...</span>
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#11]: How will researchers gain access to the data being
            collected?</span
          ><span class="list-item__subtitle">Well, it goes like this...</span>
        </div>
      </v-ons-list-item>
    </v-ons-list>
  </v-ons-page>
</template>

<script>
export default {
  name: 'FAQ',
  data() {
    return {}
  },
  mounted() {
    this.$store.commit('app/setTopTitle', 'FAQ')
  },
}
</script>
