<template>
  <div class="help-container">
    <v-ons-list>
      <v-ons-list-item modifier="nodivider">
        On this page you'll find help for the whole WOW app. There are help
        buttons throughout the app that will take you directly to the relevant
        section.
      </v-ons-list-item>
      <template v-for="currSection of sections">
        <v-ons-list-header
          :ref="currSection.id"
          :key="currSection.heading"
          class="wow-list-header"
          >{{ currSection.heading }}</v-ons-list-header
        >
        <v-ons-list-item
          v-for="(currValue, $index) of currSection.values"
          :key="currSection.heading + '-' + $index"
          modifier="nodivider"
        >
          <div class="help-value-item">
            <div v-if="!currValue.imageUrl" class="no-help-image-text">
              (No image available)
            </div>
            <div v-else-if="currValue.imageUrl.endsWith('blank')"></div>
            <div v-else-if="currValue.imageUrl">
              <img :src="currValue.imageUrl" class="help-image" />
            </div>
            <div>
              <strong>{{ currValue.value }}</strong>
            </div>
            <div>{{ currValue.helpText }}</div>
          </div>
        </v-ons-list-item>
      </template>
    </v-ons-list>
    <div class="padding-so-fab-doesnt-cover-text"></div>
    <v-ons-fab position="bottom center" @click="doClose">
      <v-ons-icon icon="fa-times"></v-ons-icon>
    </v-ons-fab>
  </div>
</template>

<script>
export default {
  name: 'Help',
  data() {
    return {
      sections: getHelpData(),
    }
  },
  methods: {
    doClose() {
      this.$emit('close')
    },
    scrollToSection(sectionName) {
      const theRef = this.$refs[sectionName]
      if (!theRef) {
        console.warn(
          `Programmer error: No help section with name='${sectionName}' found`,
        )
        return
      }
      const theElement = theRef[0].$el
      if (!theElement) {
        console.warn(
          `Programmer problem: no section with ref='${sectionName}'` +
            `found cannot scroll without target`,
        )
        return
      }
      theElement.scrollIntoView({ behavior: 'smooth' })
    },
  },
}

function getHelpData() {
  const dontWantToTypeAttributeNamesOverAndOver = [
    {
      heading: 'Photos',
      values: [
        ['Habit', 'A photo of the whole plant (required)', null],
        ['Flower', 'If the plant is flowering, this is required', null],
      ],
    },
    {
      heading: 'Field Name',
      values: [
        [
          'Species name',
          "If you think you know what the name of the Orchid is, then fill it in here.  It doesn't matter if you're wrong, because WoW experts will take your observation and do an Identification on it, to work out once and for all what species your sighting is.  If you don't know the Orchid's name, just putting a simple descriptive name like \"purple waxy flowers\" is fine.",
          'blank',
        ],
      ],
    },
    {
      heading: 'Orchid type',
      values: [
        ['Terrestrial', 'Growing on the land', 'orchid-type-terrestrial.jpg'],
        [
          'Ephiphyte',
          'Growing in host trees/shrubs',
          'orchid-type-epiphyte.jpg',
        ],
        [
          'Lithophyte',
          'Growing in rocks (no soil)',
          'orchid-type-lithophyte.jpg',
        ],
      ],
    },
    {
      heading: 'Landuse types',
      values: [
        [
          'Conservation and natural environments',
          'Includes remnant patches amongst other land uses, such as roadside vegetation, crown land, cemeteries, parks, reservoir reserves, stock routes, land managed for Traditional indigenous uses)',
          'landuse-cne.jpg',
        ],
        [
          'Production from relatively natural environments',
          'grazed native vegetation, non-irrigated forestry excluding plantations',
          'landuse-prne.jpg',
        ],
        [
          'Production from dryland agriculture and plantations',
          'plantation forestry, modified pasture grazing, non-irrigated cropping/orchards/flower farms/vineyards',
          'landuse-dap.jpg',
        ],
        [
          'Production from irrigated agriculture and plantations',
          'irrigated forestry plantations, irrigated pasture grazing, irrigated cropping/orchards/flower farms/vineyards',
          'landuse-piap.jpg',
        ],
        [
          'Intensive uses',
          'intensive horticulture, stockyards, manufacturing and industrial, residential, farm buildings, commercial services and utilities (including power transmission) roads, railways, mines, effluent ponds, landfill',
          'landuse-intensive.jpg',
        ],
        [
          'Water',
          'lakes, reservoirs, rivers, channels/aqueducts, marsh/wetlands, estuaries',
          'landuse-water.jpg',
        ],
      ],
    },
    {
      heading: 'Litter',
      values: [
        [
          'Yes (litter IS present)',
          'The Orchid has litter directly surrounding it.  Typical examples of litter are gum-leaves and bark.',
          'litter-present.jpg',
        ],
        [
          'NO (litter is NOT present)',
          'The Orchid does not have litter directly surrounding it.  In this case, it is typically surrounded by dirt, gravel or sand.',
          'litter-not-present.jpg',
        ],
      ],
    },
    {
      heading: 'Landform Type',
      values: [
        [
          'Crest',
          'A crest landform type stands above all, or almost all, points in the adjacent terrain.  Crests include hillcrests, summits, risecrests and dunecrests.',
          'landform-type-overview.jpg',
        ],
        [
          'Hill (hillock)',
          'A	Hill or (hillock) is a small mound or hill.  Hills or hillocks can include: rises, hummocky dunes, parabolic dunes, barchane dunes, linear or longitudiinal dunes, cones and mounts.',
          'blank',
        ],
        [
          'Ridge',
          'A Ridge is a chain of mountains or hills that for a continuous elevated crest. The sides of the ridge slope away on either side of a narrow top.  Examples of Ridges include dune, foredune, lunette, beach ridge, embankment and dam.',
          'blank',
        ],
        [
          'Slope (unspecified)',
          'Use this option if you are not sure if it is a is lower, mid or simple slope.  Examples include the following landform elements: cliff, scarp, hillslope and embankment.',
          'blank',
        ],
        [
          'Slope (simple)',
          'A simple slope is a slope element below a crest or flat and adjacent above a flat or depression.  A Slope is a planar landform element that is neither a crest nor a depression and has an inclination greater than about 1%.',
          'blank',
        ],
        [
          'Slope (mid)',
          'A Mid-slope is a planar landform element that is neither a crest nor a depression and has an inclination greater than about 1%. A mid-slope is a slope element not adjacent below a crest or flat and not adjacent above a flat or depression.  Mid-slopes can include the following landform elements: breakaway, cliff-footslope, bench and berms.',
          'blank',
        ],
        [
          'Slope (lower)',
          'A Lower-slope is a planar landform element that is neither a crest nor a depression and has an inclination greater than about 1%.  A lower slope is a slope element not adjacent below a crest or flat but adjacent above a flat or depression.  Lower slopes can include the following landform elements: footslopes, pediment',
          'blank',
        ],
        [
          'Flat',
          'A flat is a relatively level surface of land within a region of greater relief, such as hills or mountains. Flat is also used to describe other level geographic areas as mud flats or tidal flats.  Flats can include the following landform elements: plains, rock flats, rock platforms, scald, valley flat, terrace flat, flood-out, tidal flat and berm.',
          'blank',
        ],
        [
          'Open depression',
          'Open depressions can include the following landform elements:  gully, drainine depression, stream channels, stream bed, tidal creeks, estuary, swamps, swales and trench.',
          'blank',
        ],
        [
          'Closed depression',
          'Closed depressions can include the folling landform elements: lakes, swamps, lagoons, craters, pits, doline and basins.',
          'blank',
        ],
      ],
    },
    {
      heading: 'Sign of disturbance and threats',
      values: [['FIXME', 'fill this in', null]],
    },
    {
      heading: 'Landform Type',
      values: [['FIXME', 'fill this in', null]],
    },
    {
      heading: 'Rock cover size',
      values: [['FIXME', 'fill this in', null]],
    },
    {
      heading: 'Accuracy of Population Count',
      values: [['FIXME', 'fill this in', null]],
    },
    {
      heading: 'Accuracy of Search Area Calculation',
      values: [['FIXME', 'fill this in', null]],
    },
    {
      heading: 'Phenology (Occurring)',
      values: [
        ['Vegetative', '<blurb>', 'phenology-vegetative.jpg'],
        ['Budding', '<blurb>', 'phenology-budding.jpg'],
        ['Flowering', '<blurb>', 'phenology-flowering.jpg'],
        ['Senescent Flower', '<blurb>', 'phenology-senescent-flowers.jpg'],
        ['Developing Fruit', '<blurb>', 'phenology-developing-fruit.jpg'],
        ['Senescent Fruit', '<blurb>', 'phenology-senescent-fruit.jpg'],
      ],
    },
    {
      heading: 'Phenology (Dominant)',
      values: [
        [
          'Please use the same guidance as supplied above for the "Phenology (Occurring)" data item.',
          '',
          'blank',
        ],
      ],
    },

    {
      heading: 'Floral visitors',
      values: [
        ['Native bee', '<blurb>', 'visitors-native-bee.jpg'],
        ['Introduced honey bee', '<blurb>', 'visitors-introduced-bee.jpg'],
        ['Native wasp', '<blurb>', 'visitors-native-wasp.jpg'],
        ['Native fly', '<blurb>', 'visitors-native-fly.jpg'],
        ['Fungus gnat', '<blurb>', 'visitors-fungus-gnat.jpg'],
        ['Ant', '<blurb>', 'visitors-ant.jpg'],
        [
          'Unknown insect',
          '<blurb>',
          'visitors-unknown-other-invertebrate.jpg',
        ],
        [
          'None Observed',
          'There were no insects on the orchid when the observation was made.',
          'blank',
        ],
      ],
    },
    {
      heading: 'Cover of the most Dominant Stratum',
      values: [['FIXME', 'fill this in', 'blank']],
    },
    {
      heading: 'Vegetation Community Notes',
      values: [['FIXME', 'fill this in', 'blank']],
    },
  ]
  return dontWantToTypeAttributeNamesOverAndOver.map(currSection => {
    const helpImageUrlPrefix = '/img/help/'
    return {
      ...currSection,
      id: currSection.heading.toLowerCase().replace(' ', '-'),
      values: currSection.values.map(currValue => {
        const imageSuffix = currValue[2]
        return {
          value: currValue[0],
          helpText: currValue[1],
          imageUrl: imageSuffix ? helpImageUrlPrefix + imageSuffix : null,
        }
      }),
    }
  })
}
</script>

<style scoped>
.help-container {
  width: 100vw;
  height: 100vh;
  color: black;
  background-color: white;
  overflow-y: auto;
}

.padding-so-fab-doesnt-cover-text {
  height: 80vh;
}

.help-value-item {
  flex-direction: column;
  align-items: stretch;
}

.no-help-image-text {
  color: #666;
}

.help-image {
  border-radius: 25px;
  box-shadow: 5px 5px 8px #888888;
  margin: 20px;
  max-width: 90vw;
}
</style>
