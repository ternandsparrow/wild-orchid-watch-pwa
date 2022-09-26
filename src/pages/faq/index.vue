<template>
  <menu-wrapper title="FAQ">
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
  </menu-wrapper>
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
      q: 'Who will make definitive Identifications of the orchids that are sighted?',
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
      a: `If you have any questions, issues or feedback about this app, you
          can contact our team through two methods. The first is a contact
          mechanism built into this app. You can find it as the
          "Report Problem" item in the menu. Alternatively, you can send an
          email to <a href="mailto:info@wildorchidwatch.org"
          target="_blank">info@wildorchidwatch.org</a>.`,
    },
    {
      q: 'Will the app use up all my mobile data?',
      a: `It's hard to say exactly how much data each observation will use as it
          depends on the quality of the photos you take. Modern day smartphone
          cameras, in high quality mode (16 megapixels), often produce photos of
          6-9 MB. So a typical observation, with 3 high quality photos, is likely
          to use 18-27 MB of data as it uploads. If you want to use less data, you
          can adjust the settings of your camera app to take smaller photos.
          Alternatively, in the settings menu of this app, you can set "when to
          upload" to control when observations can upload.`,
    },
    {
      q: 'Will the app use up all my phone storage?',
      a: `This mainly depends on how large your photos are and how much free
          space you have on the phone. A 6mp photo is around 1-2MB whereas a 16mp
          photo is 6-9MB. An observation requires at least 3 photos but can have as
          many as you'd like to attach. This space is only used while the
          observation is waiting to upload to the cloud. Once it's uploaded, the
          space is freed up.`,
    },
    {
      q: 'Will the pictures I take be stored on my phone also, for me?',
      a: `It depends on your phone and your camera app. Some will helpfully save
          a copy of the photos to your gallery, but others will not. Unfortunately
          the WOW app cannot control this. If you don't like this behaviour, using a
          different camera app can give different results.`,
    },
    {
      q: 'Can I use an external camera to take the photos and the app to submit them?',
      a: `Yes, instructions are <a target="_blank"
          href="https://static1.squarespace.com/static/5a262efba9db09c818b5d8d0/t/5ecb2bcce7d73d6dee2ac1b8/1590373329341/Bulk+upload.docx.pdf">
          here</a>.`,
    },
    {
      q: 'Can I submit a sighting using photos that I took before?',
      a: `Yes, instructions are <a target="_blank"
          href="https://static1.squarespace.com/static/5a262efba9db09c818b5d8d0/t/5ecb2bcce7d73d6dee2ac1b8/1590373329341/Bulk+upload.docx.pdf">
          here</a>.`,
    },
    {
      q: 'Will the orchids be "safe" when I make sightings with their location?',
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
  return theData.map((e) => ({
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
