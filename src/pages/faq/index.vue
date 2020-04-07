<template>
  <v-ons-page>
    <custom-toolbar back-label="Home" title="FAQ" />
    <v-ons-list>
      <v-ons-list-item v-for="(currItem, $index) of items" :key="currItem.q">
        <div class="center">
          <span class="list-item__title"
            >[#{{ $index + 1 }}]: {{ currItem.q }}</span
          >
          <!-- eslint-disable -->
          <!-- v-html won't be an XSS risk as we control the data -->
          <span
            v-for="currA of currItem.a"
            :key="currA"
            class="list-item__subtitle"
            v-html="currA"
          ></span>
          <!-- eslint-enable -->
        </div>
      </v-ons-list-item>
    </v-ons-list>
  </v-ons-page>
</template>

<script>
export default {
  name: 'FAQ',
  data() {
    return {
      items: getItems(),
    }
  },
}

function getItems() {
  const theData = [
    {
      q: 'Do I need to be super-accurate on all the questions you are asking?',
      a:
        "Please answer to the best of your ability. If you don't know " +
        'the answer, you can leave non-required questions blank.',
    },
    {
      q:
        'Who will make definitive Identifications of the orchids that are sighted?',
      a: [
        'Orchid observations submitted via the WOW app will be stored and ' +
          'manged on the iNaturalist platform. iNaturalist uses crowd-sourcing ' +
          'to assign species identification.',

        'From the iNaturalist website: “Each identification helps confirm or ' +
          "improve the community's opinion on the organism that the " +
          'observation represents. We call this link between an observation ' +
          'and its organism the Observation Taxon. If the Observation Taxon is ' +
          'precise enough and has community support, an observation can become ' +
          'a Research quality record of that organism at a location and time.” ' +
          'An Observation Taxon will be assigned when more than 2/3 of ' +
          'identifications reach consensus.',

        `In the case of unusual or difficult species a moderator may assist ` +
          `with identification. More information in the 'identifying ` +
          `observations' tab on the iNaturalist website: <a ` +
          `href="https://www.inaturalist.org/pages/getting+started#how_ident_wo` +
          `rk" ` +
          `>https://www.inaturalist.org/pages/getting+started#how_ident_work</a` +
          ` >`,
      ],
    },
    {
      q: "What should I use for a field name if I don't really know?",
      a:
        'You can assign a field name or leave field name blank. The species ' +
        'identification (Observation Taxon) will be reached through consensus ' +
        'by the iNaturalist community.',
    },
    {
      q: 'Do I need to take all of the photos?',
      a:
        'No, but please take as many as are relevant. Eg. if there isn’t a ' +
        'pollinator or flower present, then it is okay not to include photos ' +
        'of them.',
    },
    {
      q: 'If something goes wrong in the app, how do I report it?',
      a:
        'Please contact <a href="mailto:info@wildorchidwatch.org" ' +
        'target="_blank">info@wildorchidwatch.org</a> if you encounter any ' +
        'issues with the WOW app.',
    },
    {
      q: 'Will the app use up all my data?',
      a:
        'Each observation will use approximately __MB of data to upload. You ' +
        'can change the settings in the app to only upload your sightings ' +
        'once in range of wifi, instructions here.',
    },
    {
      q: 'Will the app use up all my phone storage?',
      a:
        'This mainly depends on how large your photos are. A 6mp photo is ' +
        'around 1-2MB whereas a 16mp photo is 6-9MB. An observation requires ' +
        "at least 3 photos but can have as many you'd like to attach. The " +
        'WOW app can resize photos automatically so they both take up less ' +
        'storage and use less data when uploading. See the settings menu.',
    },
    {
      q: 'Will the pictures I take be stored on my phone also, for me?',
      a:
        'Yes, all of the photos ypou take will be stored as "normal" photos, ' +
        'and you can find them on your phone in the same way you access other ' +
        'photos you have taken.',
    },
    {
      q:
        'Can I use an external camera to take the photos and the app to submit them?',
      a: 'Yes, instructions here.',
    },
    {
      q: 'Can I submit a sighting using photos that I took before?',
      a: 'Yes, instructions here.',
    },
    {
      q:
        'Will the orchids be "safe" when I make sightings with their location?',
      a:
        'All orchid observations submitted via the WOW app will have ' +
        'geoprivacy set to ‘obscured’. This means that when a user looks at a ' +
        'map of orchid locations, they will see a 0.2 x 0.2 degree rectangular ' +
        'cell (about 400 km2) encompassing the hidden true coordinates. ' +
        'iNaturalist obscures the locations of all taxa with an IUCN ' +
        '(International Union Conservation of Nature) equivalent status of ' +
        'Near Threatened or higher. More information on iNaturalist here <a ' +
        'href="https://www.inaturalist.org/pages/geoprivacy" ' +
        'target="_blank">https://www.inaturalist.org/pages/geoprivacy</a>',
    },
    {
      q: 'How will researchers gain access to the data being collected?',
      a:
        'iNaturalist will store the data for all observation locations.  These ' +
        'locations will be accessible to state government data mangers and WOW ' +
        'project managers. When a researcher would like access to the data ' +
        'they will apply via existing protocols as managed by relevant state ' +
        'government agencies.',
    },
  ]
  return theData.map(e => ({
    ...e,
    // map single paragraph answers to a common format
    a: typeof e.a === 'string' ? [e.a] : e.a,
  }))
}
</script>

<style lang="scss" scoped>
/* stops long words (like URLs) from propping elements at widths wider than the
 * viewport */
.list-item__subtitle {
  word-break: break-word;
}
</style>
