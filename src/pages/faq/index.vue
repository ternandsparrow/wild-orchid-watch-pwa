<template>
  <v-ons-page>
    <custom-toolbar back-label="Home" title="FAQ" />
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
          ><span class="list-item__subtitle"
            >Please answer to the best of your ability. If you don't know the
            answer, you can leave non-required questions blank.</span
          >
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#2]: Who will make definitive Identifications of the orchids that
            are sighted?</span
          ><span class="list-item__subtitle"
            >Orchid observations submitted via the WOW app will be stored and
            manged on the iNaturalist platform. iNaturalist uses crowd-sourcing
            to assign species identification.</span
          >
          <span class="list-item__subtitle"
            >From the iNaturalist website: “Each identification helps confirm or
            improve the community's opinion on the organism that the observation
            represents. We call this link between an observation and its
            organism the Observation Taxon. If the Observation Taxon is precise
            enough and has community support, an observation can become a
            Research quality record of that organism at a location and time.” An
            Observation Taxon will be assigned when more than 2/3 of
            identifications reach consensus.</span
          >
          <span class="list-item__subtitle"
            >In the case of unusual or difficult species a moderator may assist
            with identification. More information in the 'identifying
            observations' tab on the iNaturalist website:
            <a
              href="https://www.inaturalist.org/pages/getting+started#how_ident_work"
              >https://www.inaturalist.org/pages/getting+started#how_ident_work</a
            ></span
          >
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#3]: What should I use for a field name if I don't really
            know??</span
          ><span class="list-item__subtitle"
            >You can assign a field name or leave field name blank. The species
            identification (Observation Taxon) will be reached through consensus
            by the iNaturalist community.</span
          >
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#4]: Do I need to take all of the photos?</span
          ><span class="list-item__subtitle"
            >No, but please take as many as are relevant. Eg. if there isn’t a
            pollinator or flower present, then it is okay not to include photos
            of them.</span
          >
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#5]: If something goes wrong in the app, how do I report it?</span
          ><span class="list-item__subtitle"
            >Please contact info@wildorchidwatch.org if you encounter any issues
            with the WOW app.</span
          >
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#6]: Will the app use up all my data?</span
          ><span class="list-item__subtitle"
            >Each observation will use approximately __MB of data to upload. You
            can change the settings in the app to only upload your sightings
            once in range of wifi, instructions here.</span
          >
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#6]: Will the app use up all my phone storage?</span
          ><span class="list-item__subtitle"
            >Each observation will use approximately __MB of data to upload. You
            can change the settings in the app to only upload your sightings
            once in range of wifi, instructions here.</span
          >
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#7]: Will the pictures I take be stored on my phone also, for
            me?</span
          ><span class="list-item__subtitle">
            By deadfult, no, the photos you take will NOT also be automatically
            be stored as "normal" photos in your CameraRoll. To do this, you
            will need to have or install a "Camera" App that saves the photos to
            the CameraRoll (this is sometimes default on Android phones,
            depending on the Phone manufacturer/model). You will then be able to
            find them on your phone in the same way you access other photos you
            have taken.
          </span>
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#8]: Can I use an external camera to take the photos and the app
            to submit them?</span
          ><span class="list-item__subtitle">Yes, instructions here.</span>
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#9]: Can I submit a sighting using photos that I took
            before?</span
          ><span class="list-item__subtitle">Yes, instructions here.</span>
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#10]: Will the orchids be "safe" when I make sightings with their
            location?</span
          ><span class="list-item__subtitle"
            >All orchid observations submitted via the WOW app will have
            geoprivacy set to ‘obscured’. This means that when a user looks at a
            map of orchid locations, they will see a 0.2 x 0.2 degree
            rectangular cell (about 400 km2) encompassing the hidden true
            coordinates. iNaturalist obscures the locations of all taxa with an
            IUCN (International Union Conservation of Nature) equivalent status
            of Near Threatened or higher. More information on iNaturalist here
            <a href="https://www.inaturalist.org/pages/geoprivacy"
              >https://www.inaturalist.org/pages/geoprivacy</a
            >
          </span>
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#11]: How will researchers gain access to the data being
            collected?</span
          ><span class="list-item__subtitle"
            >iNaturalist will store the data for all observation locations.
            These locations will be accessible to state government data mangers
            and WOW project managers. When a researcher would like access to the
            data they will apply via existing protocols as managed by relevant
            state government agencies.</span
          >
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

<style lang="scss" scoped>
/* stops long words (like URLs) from propping elements at widths wider than the
viewport */
.list-item__subtitle {
  word-break: break-word;
}
</style>
