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
        [
          'Whole Plant',
          'Show the plant habit; that is, its overall shape and form. Where possible please use a scale card or item such as a coin to show the height and width of the flower stem.',
          'photo-habit.jpg',
        ],
        [
          'Flower',
          'Please include photos of the individual flower from the front, side, and back. If relevant photograph whole inflorescence (complete flower head). If possible please use a scale card (see example photo) or item such as a coin for scale.',
          'photo-flower.jpg',
        ],
        [
          'Leaf',
          'Include photos of the leaf showing shape and any vein patterns, using a scale if possible.',
          'photo-leaf.jpg',
        ],
        [
          'Fruit',
          'Photos of fruit including colour and size. Include scale if possible.',
          'photo-fruit.jpg',
        ],
        [
          'Habitat',
          'Habitat features to include in photo: where present try to capture dominant ground cover, shrubs and canopy vegetation. Any obvious landscape features such as water bodies or evidence of fire.',
          'photo-habitat.jpg',
        ],
        [
          'Micro-habitat',
          'Photograph the ground directly beneath the orchid. About 20cm x 20cm.',
          'photo-micro-habitat.jpg',
        ],
        [
          'Canopy',
          'Take a photo straight up into the canopy directly above the orchid.',
          'photo-canopy.jpg',
        ],
        [
          'Floral visitors',
          'Photograph any potential pollinators on the orchid. May be hard to capture, but great if you can!',
          'visitors-fungus-gnat.jpg',
        ],
        [
          'Epiphyte host tree',
          'When an orchid is growing on another plant (ie. is not terrestrial) please photograph the host tree/plant',
          'orchid-type-epiphyte.jpg',
        ],
      ],
    },
    {
      heading: 'Field Name',
      values: [
        [
          'Species name',
          'Fill in the name of the orchid here. If you know the scientific name please use it, if not a simple descriptive name such as “purple waxy flowers” is fine. The iNaturalist community will verify or add a name for you.',
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
          'Growing in host trees/shrubs.',
          'orchid-type-epiphyte.jpg',
        ],
        [
          'Ephiphyte Host species',
          'If the species of the host is known, use the scientific or common name, or if name unknown, you can enter a descriptive name e.g. yellow waxy flowers.  Epiphyte height: Estimate the number of metres above ground level the orchid is growing on the host plant.',
          'blank',
        ],
        [
          'Epiphyte height',
          'Estimate the number of metres above ground level the orchid is growing on the host plant.',
          'blank',
        ],
        [
          'Lithophyte',
          'Growing on rocks (no soil)',
          'orchid-type-lithophyte.jpg',
        ],
      ],
    },
    {
      heading: 'Litter',
      values: [
        [
          'Yes (litter IS present)',
          'Presence of distinct plant litter layer (i.e. leaf layer, twig debris) in vicinity of orchids (note also available via microhabitat photo)',
          'litter-present.jpg',
        ],
        [
          'NO (litter is NOT present)',
          'Absence of distinct plant litter layer (i.e. leaf layer, twig debris) in vicinity of orchids (note also available via microhabitat photo)',
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
          'A Slope is a planar landform element that is neither a crest nor a depression and has an inclination greater than about 1%. Use this option if you are not sure if it is a is lower, mid or simple slope.  Examples include the following landform elements: cliff, scarp, hillslope and embankment.',
          'blank',
        ],
        [
          'Slope (simple)',
          'A simple slope is a slope element below a crest or flat and adjacent above a flat or depression',
          'blank',
        ],
        [
          'Slope (mid)',
          'A mid-slope is a slope element not adjacent below a crest or flat and not adjacent above a flat or depression.',
          'blank',
        ],
        [
          'Slope (lower)',
          'A lower slope is a slope element not adjacent below a crest or flat but adjacent above a flat or depression.',
          'blank',
        ],
        [
          'Flat',
          'A flat is a relatively level surface of land within a region of greater relief, such as hills or mountains. Flat is also used to describe other level geographic areas as mud flats or tidal flats.',
          'blank',
        ],
        [
          'Open depression',
          'Open depressions can include the following landform elements:  gully, drainine depression, stream channels, stream bed, tidal creeks, estuary, swamps, swales and trench.',
          'blank',
        ],
        [
          'Closed depression',
          'Closed depressions can include the following landform elements: lakes, swamps, lagoons, craters, pits, doline and basins.',
          'blank',
        ],
      ],
    },
    {
      heading: 'Evidence of disturbance and threats',
      values: [
        ['Chemical spraying', '', 'disturbance-chemical-spraying.jpg'],
        ['Cultivation', '', 'disturbance-cultivation.jpg'],
        ['Dieback', 'FIXME - add IMAGE', 'disturbance-dieback.jpg'],
        ['Fire', '', 'disturbance-fire.jpg'],
        [
          'Firewood/coarse woody debris removal',
          '',
          'disturbance-firewood.jpg',
        ],
        [
          'Grazing (feral, i.e. rabbits, goats)',
          'FIXME - add IMAGE',
          'disturbance-grazing-feral.jpg',
        ],
        [
          'Grazing (stock present or scats)',
          '',
          'disturbance-grazing-stock.jpg',
        ],
        [
          'Grazing (native species, presence of roo/possum scats)',
          '',
          'disturbance-grazing-native.jpg',
        ],
        ['Mowing/slashing', '', 'disturbance-mowing-slashing.jpg'],
        [
          'Rubbish dumping (excl. small litter items)',
          'FIXME - add IMAGE',
          'disturbance-rubbish.jpg',
        ],
        ['Storm damage', '', 'disturbance-storm-damage.jpg'],
        ['Soil erosion (incl. run-off)', '', 'disturbance-erosion.jpg'],
        ['Trampling (human)', '', 'disturbance-trampling-human.jpg'],
        ['Vegetation clearance', '', 'disturbance-veg-clearing.jpg'],
        ['Weed invasion', '', 'disturbance-weed.jpg'],
        ['Other human disturbance', 'FIXME - add comment', 'blank'],
      ],
    },
    {
      heading:
        'Soil surface structure as observed on the surface (NO DIGGING!)',
      values: [
        ['Unknown', 'Not able to classify the soil structure', 'blank'],
        ['Sand', 'Loose, granular, felt or heard when pinching.', 'blank'],
        ['Loam', 'A fertile soil of clay and sand containing humus.', 'blank'],
        ['Clay', 'Sticky, cohesive or plastic feeling.', 'blank'],
      ],
    },
    {
      heading: 'Rock cover size',
      values: [
        [
          'Multiple selections possible. Please choose all rock size classes visible on the soils surface within 1m radius of the orchid.',
          '',
          'blank',
        ],
      ],
    },
    {
      heading:
        'Accuracy of population count (how accurate is the count of individuals recorded?)',
      values: [
        ['Exact', 'Count of individuals within the defined area.', 'blank'],
        [
          'Partial count',
          'A fertile soil of clay and sand containing humus.',
          'blank',
        ],
        [
          'Extrapolated/estimate',
          'Spatially defined subset of the population',
          'blank',
        ],
      ],
    },
    {
      heading:
        'Accuracy of search area calculation (how accurate is the search area recorded?)',
      values: [
        [
          'Precise',
          'For example transect/quadrat measured with a tape measure (assumes rectangle or square shape).',
          'blank',
        ],
        ['Estimated', 'Visual guess or paced area.', 'blank'],
      ],
    },
    {
      heading: 'Precise area measurements (m2)',
      values: [
        [
          'Precise',
          'For example transect/quadrat measured with a tape measure (assumes rectangle or square shape) – select (from the drop downs) the precise area measurement widths (m) and length (m).',
          'blank',
        ],
        [
          'Estimated',
          'Visual guess or paced area (no additional width or length data required).',
          'blank',
        ],
      ],
    },
    {
      heading: 'Estimated area searched and Area of Population (m2)',
      values: [
        [
          'How large is the area you searched while counting individuals? Only required when observing more than one individual – recommended linear search areas (i.e. rectangles along paths)',
          '',
          'blank',
        ],
        ['', '1m2 (i.e. 1x1 or similar)', 'blank'],
        ['', '4m2 (i.e. 2x2 or similar)', 'blank'],
        ['', '10m2 (i.e. 5x2 or similar)', 'blank'],
        ['', '36m2 (i.e. 18x2 or similar), etc.', 'blank'],
      ],
    },
    {
      heading: 'Search effort (minutes)',
      values: [
        [
          'Time spent surveying: minutes actively searching not just time at the location doing other tasks) i.e. 2 people for 30 minutes = 60 minutes',
          '',
          'blank',
        ],
        ['', 'e.g. <1, A few minutes, 5, 10 , etc.', 'blank'],
      ],
    },
    {
      heading: 'Number of individuals recorded',
      values: [
        [
          'Enter a full number which is the count of individuals you tallied.',
          '',
          'blank',
        ],
      ],
    },
    {
      heading: 'Phenology (Occurring)',
      values: [
        [
          'Vegetative',
          'Only leaves and stem, no reproductive material present (ie. flowers or fruit)',
          'phenology-vegetative.jpg',
        ],
        ['Flowering', 'Flower/s visible and open', 'phenology-flowering.jpg'],
        ['Budding', 'Budding – flower/s not yet open', 'phenology-budding.jpg'],
        [
          'Senescent Flower',
          'Withering, dried flowers.',
          'phenology-senescent-flowers.jpg',
        ],
        [
          'Developing Fruit',
          'Swelling of ovary (organ containing seeds) and flower withering or absent.',
          'phenology-developing-fruit.jpg',
        ],
        [
          'Senescent Fruit',
          'Ripe fruit or seed pods',
          'phenology-senescent-fruit.jpg',
        ],
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
      heading: 'Folivory damage noted',
      values: [['', 'FIXME - add an explanation', 'blank']],
    },
    {
      heading: 'Floral visitors',
      values: [
        ['Native bee', '', 'visitors-native-bee.jpg'],
        ['Introduced honey-bee', '', 'visitors-introduced-bee.jpg'],
        ['Native wasp', '', 'visitors-native-wasp.jpg'],
        ['Native fly', '', 'visitors-native-fly.jpg'],
        ['Fungus gnat', '', 'visitors-fungus-gnat.jpg'],
        ['Ant', '', 'visitors-ant.jpg'],
        [
          'Unknown/other invertebrate',
          "There was an invertebrate sighted, but you're unsure of what species it was, or it was an animal not in the list of options.",
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
      heading: 'Dominant Vegetation growth form',
      values: [
        [
          'Tree',
          'Woody plants, more than 2m tall with a single stem or branches well above the base.',
          'blank',
        ],
        [
          'Shrub',
          'Woody plants multi-stemmed at the base (or within 200mm from ground level) or if single stemmed, less than 2m.',
          'blank',
        ],
        [
          'Shrub (Heath)',
          'Shrub usually less than 2m, with sclerophyllous leaves having high fibre: protein ratios and with an area of nanophyll or smaller (less than 225 sq mm). Often a member of one the following families: Ericaceae, Myrtaceae, Fabaceae and Proteaceae. Commonly occur on nutrient-poor substrates.',
          'blank',
        ],
        [
          'Shrub (Chenopod)',
          'Single or multi-stemmed, semi-succulent shrub of the family Chenopodiaceae exhibiting drought and salt tolerance.',
          'blank',
        ],
        [
          'Grass-Tree',
          'Australian grass trees. Members of the Xanthorrhoeaceae family.',
          'blank',
        ],
        [
          'other  Grass',
          'Member of the family Poaceae, but having neither a distinctive tussock nor hummock appearance. Examples include stoloniferous species such as Cynodon dactylon.',
          'blank',
        ],
        [
          'Tussock Grass',
          'Grass forming discrete but open tussocks usually with distinct individual shoots, or if not, then forming a hummock. These are the common agricultural grasses.',
          'blank',
        ],
        [
          'Hummock Grass',
          'Coarse xeromorphic grass with a mound-like form often dead in the middle; genus is Triodia.',
          'blank',
        ],
        [
          'Tree (Mallee)',
          'Woody perennial plant usually of the genus Eucalyptus. Multi-stemmed with fewer than five trunks of which at least three exceed 100mm diameter at breast height (1.3m). Usually 8m or more.',
          'blank',
        ],
        [
          'Shrub (Mallee)',
          'Commonly less than 8m tall, usually with five or more trunks, of which at least three of the largest do not exceed 100mm in diameter at breast height (1.3 m).',
          'blank',
        ],
        [
          'Sedge',
          'Herbaceous, usually perennial erect plant generally with a tufted habit and of the families Cyperaceae (true sedges) or Restionaceae (node sedges).',
          'blank',
        ],
        [
          'Shrub (Samphire)',
          'Genera (of Tribe Salicornioideae, viz.: Halosarcia, Pachycornia, Sarcocornia, Sclerostegia, Tecticornia and Tegicornia) with articulate branches, fleshy stems and reduced flowers within the Chenopodiaceae family, succulent chenopods (Wilson 1980). Also the genus Suaeda.',
          'blank',
        ],
        [
          'Rush',
          'Herbaceous, usually perennial erect monocot that is neither a grass nor a sedge. For the purposes of NVIS, rushes include the monocotyledon families Juncaceae, Typhaceae, Liliaceae, Iridaceae, Xyridaceae and the genus Lomandra. (i.e. "graminoid" or grass-like genera).',
          'blank',
        ],
        [
          'Forb',
          'Herbaceous or slightly woody, annual or sometimes perennial plant. (Usually a dicotyledon).',
          'blank',
        ],
        [
          'Tree Fern',
          'Characterised by large and usually branched leaves (fronds), arborescent and terrestrial; spores in sporangia on the leaves.',
          'blank',
        ],
        [
          'Fern',
          'Ferns and fern allies, except tree-fern, above. Characterised by large and usually branched leaves (fronds), herbaceous and terrestrial to aquatic; spores in sporangia on the leaves.',
          'blank',
        ],
        [
          'Vine',
          'Climbing, twining, winding or sprawling plants usually with a woody stem.',
          'blank',
        ],
        [
          'Palm',
          'Palms and other arborescent monocotyledons. Members of the Arecaceae family or the genus Pandanus. (Pandanus is often multi-stemmed).',
          'blank',
        ],

        ['Cycad', 'Members of the families Cycadaceae and Zamiaceae.', 'blank'],
      ],
    },
    {
      heading: 'Height of the most dominant growth form present',
      values: [['', 'FIXME - add a description', 'blank']],
    },
    {
      heading: 'Cover of the most Dominant Stratum',
      values: [
        [
          'Foliage cover',
          'The proportion of ground cover which would be shaded if sunshine came directly overhead, including branches and leaves.',
          'blank',
        ],
      ],
    },
    {
      heading: 'Vegetation Community Notes',
      values: [
        [
          'Free-text',
          'Here, you can enter additional information, such as genera/species of the dominant plants present.',
          'blank',
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
          'Grazed native vegetation, non-irrigated forestry excluding plantations',
          'landuse-prne.jpg',
        ],
        [
          'Production from dryland agriculture and plantations',
          'Plantation forestry, modified pasture grazing, non-irrigated cropping/orchards/flower farms/vineyards',
          'landuse-dap.jpg',
        ],
        [
          'Production from irrigated agriculture and plantations',
          'Irrigated forestry plantations, irrigated pasture grazing, irrigated cropping/orchards/flower farms/vineyards',
          'landuse-piap.jpg',
        ],
        [
          'Intensive uses',
          'intensive horticulture, stockyards, manufacturing and industrial, residential, farm buildings, commercial services and utilities (including power transmission) roads, railways, mines, effluent ponds, landfill',
          'landuse-intensive.jpg',
        ],
        [
          'Water',
          'Lakes, reservoirs, rivers, channels/aqueducts, marsh/wetlands, estuaries',
          'landuse-water.jpg',
        ],
      ],
    },
    {
      heading: 'Help section Credits',
      values: [
        [
          'Photos',
          'Nicola Barnes, Tali Moyle, Brian Coulter, Angelina Rowell, Samantha Bywaters, Sabine Hansch, Anita Marquart, Rosalie Lawrence, Robert Lawrence, Sally O’Neill, Katie Irvine',
          'blank',
        ],
        [
          'Source',
          'Start with the Leaves: A simple guide to common orchids and lilies of the Adelaide Hills Robert Lawrence, Heritage Bushcare 2011',
          'blank',
        ],
      ],
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
