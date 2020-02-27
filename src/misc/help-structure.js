import * as constants from '@/misc/constants'

const phenologyValues = [
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
]

const commonLanduseValues = [
  [
    'Production from relatively natural environments',
    'Grazed native vegetation, non-irrigated forestry excluding plantations.',
    'landuse-prne.jpg',
  ],
  [
    'Production from dryland agriculture and plantations',
    'Plantation forestry, modified pasture grazing, non-irrigated cropping/orchards/flower farms/vineyards.',
    'landuse-dap.jpg',
  ],
  [
    'Production from irrigated agriculture and plantations',
    'Irrigated forestry plantations, irrigated pasture grazing, irrigated cropping/orchards/flower farms/vineyards',
    'landuse-piap.jpg',
  ],
  [
    'Intensive uses',
    'intensive horticulture, stockyards, manufacturing and industrial, residential, farm buildings, commercial services and utilities (including power transmission) roads, railways, mines, effluent ponds, landfill.',
    'landuse-intensive.jpg',
  ],
  [
    'Water',
    'Lakes, reservoirs, rivers, channels/aqueducts, marsh/wetlands, estuaries.',
    'landuse-water.jpg',
  ],
]

export default (() => {
  const theData = [
    {
      id: 'photos',
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
      id: 'field-name',
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
      id: constants.orchidTypeObsFieldId,
      heading: 'Orchid type',
      values: [
        ['Terrestrial', 'Growing on the land', 'orchid-type-terrestrial.jpg'],
        [
          'Ephiphyte',
          'Growing in host trees/shrubs.',
          'orchid-type-epiphyte.jpg',
        ],
        [
          'Lithophyte',
          'Growing on rocks (no soil)',
          'orchid-type-lithophyte.jpg',
        ],
      ],
    },
    {
      id: constants.hostTreeSpeciesObsFieldId,
      heading: 'Ephiphyte Host species',
      values: [
        [
          '',
          'If the species of the host is known, use the scientific or common name, or if name unknown, you can enter a descriptive name e.g. yellow waxy flowers.  Epiphyte height: Estimate the number of metres above ground level the orchid is growing on the host plant.',
          'blank',
        ],
      ],
    },
    {
      id: constants.epiphyteHeightObsFieldId,
      heading: 'Ephiphyte height',
      values: [
        [
          '',
          'Estimate the number of metres above ground level the orchid is growing on the host plant.',
          'blank',
        ],
      ],
    },
    {
      id: constants.litterObsFieldId,
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
      id: constants.landformTypeObsFieldId,
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
      id: constants.soilStructureObsFieldId,
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
      id: constants.coarseFragmentsMultiselectId,
      heading: 'Rock cover size',
      values: [
        [
          '',
          'Multiple selections possible. Please choose all rock size classes visible on the soils surface within 1m radius of the orchid.',
          'blank',
        ],
      ],
    },
    {
      id: constants.accuracyOfPopulationCountObsFieldId,
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
      id: constants.accuracyOfSearchAreaCalcObsFieldId,
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
      id: constants.searchAreaCalcPreciseWidthObsFieldId,
      heading: 'Precise area measurements - width',
      values: [
        [
          '',
          'For example transect/quadrat measured with a tape measure (assumes rectangle or square shape) – the precise area measurement width in metres.',
          'blank',
        ],
      ],
    },
    {
      id: constants.searchAreaCalcPreciseLengthObsFieldId,
      heading: 'Precise area measurements - length',
      values: [
        [
          '',
          'For example transect/quadrat measured with a tape measure (assumes rectangle or square shape) – the precise area measurement length in metres.',
          'blank',
        ],
      ],
    },
    {
      id: constants.approxAreaSearchedObsFieldId,
      heading: 'Estimated area searched (m²)',
      values: [
        [
          'How large is the area you searched while counting individuals?',
          '',
          'blank',
        ],
        ['', '2m² (i.e. 1x2 or similar)', 'blank'],
        ['', '4m² (i.e. 2x2 or similar)', 'blank'],
        ['', '10m² (i.e. 5x2 or similar)', 'blank'],
        ['', '36m² (i.e. 18x2 or similar), etc.', 'blank'],
      ],
    },
    {
      id: constants.searchEffortObsFieldId,
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
      id: constants.countOfIndividualsObsFieldId,
      heading: 'Number of individuals recorded',
      values: [
        [
          '',
          'Enter a full number which is the count of individuals you tallied.',
          'blank',
        ],
      ],
    },
    {
      id: constants.areaOfPopulationObsFieldId,
      heading: 'Area of Population (m²)',
      values: [
        [
          'How large is the area occupied by individual orchids in this population?',
          '',
          'blank',
        ],
        ['', '2m² (i.e. 1x2 or similar)', 'blank'],
        ['', '4m² (i.e. 2x2 or similar)', 'blank'],
        ['', '10m² (i.e. 5x2 or similar)', 'blank'],
        ['', '36m² (i.e. 18x2 or similar), etc.', 'blank'],
      ],
    },
    {
      id: constants.phenologyMultiselectId,
      heading: 'Phenology (Life stage occurring)',
      values: phenologyValues,
    },
    {
      id: constants.dominantPhenologyObsFieldId,
      heading: 'Phenology (Dominant life stage status most occurring)',
      values: phenologyValues,
    },
    {
      id: constants.florivoryDamageObsFieldId,
      heading: 'Florivory damage noted',
      values: [
        [
          '',
          'Please indicate if there is damage to the orchid caused by animals or insects eating the flower/s.',
          'blank',
        ],
      ],
    },
    {
      id: constants.floralVisitorsMultiselectId,
      heading: 'Floral visitors / potential pollinators observed',
      values: [
        ['Native bee', '', 'visitors-native-bee.jpg'],
        ['Introduced honeybee', '', 'visitors-introduced-bee.jpg'],
        ['Native wasp', '', 'visitors-native-wasp.jpg'],
        ['Fly', '', 'visitors-native-fly.jpg'],
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
      id: constants.dominantVegObsFieldId,
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
          'Other Grass',
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
      id: constants.heightOfDominantVegObsFieldId,
      heading: 'Height of the most dominant growth form present',
      values: [
        [
          '>30 m',
          'Maximum height of the dominant vegetation layer, i.e. for forests/woodlands, height of the tallest trees; for scrublands, height of the shrub layer.  There are other options available for selection, as appropriate.',
          'blank',
        ],
      ],
    },
    {
      id: constants.coverOfDominantStratumObsFieldId,
      heading:
        'Foliage cover of the most dominant vegetation layer (i.e. lower storey, mid storey or upper storey)',
      values: [
        [
          '70-100%',
          'The proportion of the ground, which would be shaded by branches and leaves, if sunshine came from directly overhead. Select the vegetation layer that is most dominant and estimate the foliage cover for this layer. For example, for forests and woodlands, estimate the foliage cover the trees project, but do not include the cover shrubs and grasses project. For shrublands, estimate the foliage cover the shrubs project, but do not include any scattered trees.  There are other options available for selection, as appropriate.',
          'blank',
        ],
      ],
    },
    {
      id: constants.communityNotesObsFieldId,
      heading: 'Vegetation Community Notes',
      values: [
        [
          'Free-text',
          'Please add additional information such as genera/species of the dominant plants present.',
          'blank',
        ],
      ],
    },
    {
      id: constants.immediateLanduseMultiselectId,
      heading: 'Landuse of the immediate area',
      values: [
        [
          'Conservation and natural environments',
          'Includes remnant patches amongst other land uses, such as roadside vegetation, crown land, cemeteries, parks, reservoir reserves, stock routes, land managed for Traditional indigenous uses.',
          'landuse-cne.jpg',
        ],
        ...commonLanduseValues,
      ],
    },
    {
      id: constants.widerLanduseObsFieldId,
      heading: 'Landuse of the wider area',
      values: [
        [
          'If landuse of the immediate area is conservation area and natural environment, what is the wider landuse beyond the conservation area?',
          '',
          'blank',
        ],
        ...commonLanduseValues,
      ],
    },
    {
      id: constants.evidenceThreatsMultiselectId,
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
          '',
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
          '',
          'disturbance-rubbish.jpg',
        ],
        ['Storm damage', '', 'disturbance-storm-damage.jpg'],
        ['Soil erosion (incl. run-off)', '', 'disturbance-erosion.jpg'],
        ['Trampling (human)', '', 'disturbance-trampling-human.jpg'],
        ['Vegetation clearance', '', 'disturbance-veg-clearing.jpg'],
        ['Weed invasion', '', 'disturbance-weed.jpg'],
        [
          'Other human disturbance',
          'Please add if the disturbance type is not listed above.',
          'blank',
        ],
      ],
    },
    {
      id: 'notes',
      heading: 'Notes',
      values: [
        [
          'This is for personal notes only; this information will not be included in final data set and data will not be transferred from this field into the other fields.',
          '',
          'blank',
        ],
      ],
    },
    {
      heading: 'Help section Credits',
      values: [
        [
          'Photos',
          'Nicola Barnes, Tali Moyle, Brian Coulter, Angelina Rowell, Samantha Bywaters, Sabine Hanisch, Anita Marquart, Kerri Willmott, Rosalie Lawrence, Sally O’Neill, Katie Irvine',
          'blank',
        ],
        [
          'Source',
          'Start with the Leaves: A simple guide to common orchids and lilies of the Adelaide Hills Robert Lawrence, Heritage Bushcare 2011',
          'blank',
        ],
        [
          'Landform Type diagram',
          'Modified from: Indiana Soils: Evaluation and Conservation Manual. D. P. Franzmeier, G. C. Steinhardt and B. D. Lee.Purdue University. September 2009.',
          'blank',
        ],
      ],
    },
  ]
  return theData.map(currSection => {
    const helpImageUrlPrefix = '/img/help/'
    return {
      ...currSection,
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
})()
