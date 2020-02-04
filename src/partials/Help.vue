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
            <img v-if="currValue.imageUrl" :src="currValue.imageUrl" />
            <div v-if="!currValue.imageUrl" class="no-help-image-text">
              (No image available)
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
      const theElement = this.$refs[sectionName][0].$el
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
        ['Flower', 'If the plant is flowing, this is required', null],
      ],
    },
    {
      heading: 'Field Name',
      values: [
        [
          'Species name',
          'If known use the scientific or common name, or if name unknown, you can enter a descriptive name eg. purple waxy flowers',
          null,
        ],
      ],
    },
    {
      heading: 'Orchid type',
      values: [
        ['Terrestrial', 'Growing on the land', 'orchid-type_terrestrial.png'],
        ['Ephiphyte', 'Growing in host trees/shrubs', null],
        ['Lithophyte', 'Growing in rocks (no soil)', null],
      ],
    },
    {
      heading: 'Litter',
      values: [['FIXME', 'fill this in', null]],
    },
    {
      heading: 'Landform element',
      values: [['FIXME', 'fill this in', null]],
    },
    {
      heading: 'Landuse types',
      values: [
        [
          'Production from relatively natural environments',
          'grazed native vegetation, non-irrigated forestry excluding plantations',
          null,
        ],
        [
          'Production from dryland agriculture and plantations',
          'plantation forestry, modified pasture grazing, non-irrigated cropping/orchards/flower farms/vineyards',
          null,
        ],
        [
          'Production from irrigated agriculture and plantations',
          'irrigated forestry plantations, irrigated pasture grazing, irrigated cropping/orchards/flower farms/vineyards',
          null,
        ],
        [
          'Intensive uses',
          'intensive horticulture, stockyards, manufacturing and industrial, residential, farm buildings, commercial services and utilities (including power transmission) roads, railways, mines, effluent ponds, landfill',
          null,
        ],
        [
          'Water',
          'lakes, reservoirs, rivers, channels/aqueducts, marsh/wetlands, estuaries',
          null,
        ],
      ],
    },
    {
      heading: 'Sign of disturbance and threats',
      values: [['FIXME', 'fill this in', null]],
    },
    {
      heading: 'Dominant phenology',
      values: [['FIXME', 'fill this in', null]],
    },
    {
      heading: 'Phenology occurring',
      values: [['FIXME', 'fill this in', null]],
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
  width: 100%;
  height: 100%;
  color: black;
  background-color: white;
  overflow-x: auto;
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
</style>
