const obsFieldConstants = require('../src/misc/obs-field-constants')

const isPrintOnly = !!process.env.PRINTONLY

// Creates all of our observation fields in an iNaturalist server.
//
// During dev we need to re-create them semi-often so this makes life easier.
// It can also streamline updates.
//
// Run with something like:
// $ WOW_SESSION_VALUE=5c0b232a94ea34a4a21e648b607f6593 \
//     WOW_AUTHENTICITY_TOKEN='n1wN6vpq4sHoEQkzIz9EHJEhHa+XmWzs5lcEK7xDBuW9kwk4MUxjO3LGlK/9WsNbqCRS6+8EnmiALTFUTDB2wQ==' \
//     WOW_SESSION_KEY='_devinat_session' \
//     WOW_SERVER='https://dev.inat.techotom.com' \
//     node ./create-obs-fields.js
//
// See below for how to get an authenticity token
const got = require('got') // something else pulls this in so we'll use it
const FormData = require('form-data')

// *YOU* need to config these values \/
const serverBaseUrl = process.env.WOW_SERVER || 'https://dev.inat.techotom.com'
const sessionCookieKey = process.env.WOW_SESSION_KEY || '_yoursite_session'

// Use chrome dev tools to pull this Cookie out of an active session with iNat.
// The cookie name is named after the Rails site that you configure so at the
// time of writing the prod inat (inaturalist.org) uses _inaturalist_session
// and our dev server uses _devinat_session.
// example session cookie value = '5c0b232a94ea34a4a21e648b607f6593'
const sessionCookieValue = requiredEnvVar('WOW_SESSION_VALUE')

// we're pretending to do a POST from a web page so we *need* the CSRF protection
// token. Lucky Rails seems to accept the same token repeatedly so we can get
// one once and keep using it. You can get an auth token by uncommenting the
// following fragment then running this script (and providing all env vars
// except the auth token). The output will be a bash script that you need to
// copy+paste and run. Remember to comment again so you can create the obs
// fields.

// console.log(`curl -s '${serverBaseUrl}/observation_fields/new' \
//   -H 'accept: text/html' \
//   -H 'cookie: ${sessionCookieKey}=${sessionCookieValue}' \
//   | grep -A 1 'csrf.*authenticity' | tail -n 1 | sed 's/.*content="\\(.*\\)".*/\\1/'`)
// process.exit()

// example auth token = 'nM6DtXsURZsm96E3S8w4M6E53LX7wkFKUx0+u2/43C6+AYdnsDLEYbwgPKuVqb90mDyT8YNfs841ZwvEn4usCg=='
const authenticityToken = requiredEnvVar('WOW_AUTHENTICITY_TOKEN')
// *YOU* need to config these values /\

const commonLanduses =
  'Production from relatively natural environments|Production from dryland agriculture and plantations|Production from irrigated agriculture plantations|Intensive uses|Water'
const squareAreas = '1|4|9|16|25|36|49|64|81|100|>100'
const phenologyValues =
  'Vegetative|Budding|Flowering|Senescent flower|Developing fruit|Senescent fruit'

const obsFields = [
  {
    name: 'Orchid type',
    description: '',
    datatype: 'text',
    allowedValues: `${obsFieldConstants.terrestrial}|${
      obsFieldConstants.epiphyte
    }|Lithophyte`,
  },
  // Orchid photos - not an obs field
  //  - whole plant (required)
  //  - flower
  //  - leaf
  // Habitat photos - not an obs field
  //  - habitat, site photo ~5m either side of plant (required)
  //  - microhabitat, downward looking photo ~30cm either side of plant (required)
  //  - canopy, looking upward from flower height (or chest)
  // Georeferenced location - not an obs field
  // Date - not an obs field
  // Time - not an obs field
  {
    name: 'Altitude metres',
    description:
      'Altitude (in metres), compared to sea level, that observation was made at',
    datatype: 'numeric',
    allowedValues: '',
  },
  ...multiselect(
    'Landuse of the immediate area',
    'Categorise the immediate area surrounding the observation',
    `Conservation and natural environments|${commonLanduses}`,
  ),
  {
    name: 'Wider landuse',
    description: `Categorise the wider area surrounding the observation. Only required when immediate landuse = ${
      obsFieldConstants.conservationLanduse
    }`,
    datatype: 'text',
    allowedValues: `${commonLanduses}|Unknown`,
  },
  {
    name: 'Is the plant surrounded by litter',
    description: '',
    datatype: 'text',
    allowedValues: 'Not collected|Yes|No',
  },
  {
    name: 'Host tree species',
    description: `Species of the host that this orchid grows on. Only required for Orchid Type = ${
      obsFieldConstants.epiphyte
    }`,
    datatype: 'taxon',
    allowedValues: '',
  },
  {
    name: 'Epiphyte height (cm)',
    description: `Only required for Orchid Type = ${
      obsFieldConstants.epiphyte
    }`,
    datatype: 'numeric',
    allowedValues: '',
  },
  // Host tree photo - not an obs field
  {
    name: 'Landform type',
    description: '',
    datatype: 'text',
    allowedValues: `${
      obsFieldConstants.notCollected
    }|Crest|Hill (hillock)|Ridge|Slope - unspecified|Slope - simple|Slope - mid|Slope - lower|Flat|Open depression|Closed depression`,
  },
  {
    name: 'Soil structure as observed from the surface',
    description: 'Used as an indication, NO DIGGING ALLOWED!',
    datatype: 'text',
    allowedValues: `${
      obsFieldConstants.notCollected
    }|Unknown|Sand - felt or heard when pinching|Loam|Clay`,
  },
  ...multiselect(
    'Rock cover size',
    '',
    'None|Fine gravel or small pebbles <6 mm|Medium gravel to medium pebbles 6 - 20 mm|Coarse gravel to large pebbles 20 - 60 mm|Cobbles 60 - 200 mm|Stones 200 - 600 mm|Boulders 600 - 2000 mm|Large boulders >2000 mm',
  ),
  {
    name: 'Approx area searched (m²)',
    description:
      'How large is the area you searched while counting individuals? Only required when observing more than one individual',
    datatype: 'text',
    allowedValues: `Not collected|${squareAreas}`,
  },
  {
    name: 'Search effort (minutes)',
    description:
      'Time spent surveying: minutes actively searching (not just time at the location doing other tasks) i.e. 2 people for 30 minutes = 60 minutes',
    datatype: 'text',
    allowedValues:
      'Not collected|<1|a few minutes|5|10|15|20|30|45|60|90|120|120+', // FIXME get these values
  },
  {
    name: 'Accuracy of population count',
    description: 'How accurate is the count of indiviudals recorded.',
    datatype: 'text',
    allowedValues: `${
      obsFieldConstants.exact
    }|Partial count|Extrapolated/Estimate`,
  },
  {
    name: 'Area of exact count (m²)',
    description: 'Size of the area searched while performing an exact count',
    datatype: 'text',
    allowedValues: squareAreas,
  },
  {
    name: 'Number of individuals recorded',
    description: 'How many individual orchids did you observe?',
    datatype: 'numeric',
    allowedValues: '',
  },
  {
    name: 'Area of population (m²)',
    description: 'Only applicable when recording >1 individual',
    datatype: 'text',
    allowedValues: squareAreas,
  },
  {
    name: 'Dominant vegetation growth form',
    description: '',
    datatype: 'text',
    allowedValues: `${
      obsFieldConstants.notCollected
    }|Tree|Tree mallee|Shrub|Mallee shrub|Heath shrub|Chenopod shrub|Samphire shrub|Tussock grass|Hummock grass|Other grass|Sedge|Rush|Forb|Tree-fern|Fern|Vine|Palm|Gress-tree|Cycad|Unknown`,
  },
  {
    name: 'Height of the most dominant growth form present (metres)',
    description:
      'Maximum height of the dominant vegetation layer, i.e. for forests/woodlands, height of the tallest trees; for shrublands, height of the shrub layer',
    datatype: 'text',
    allowedValues: `${
      obsFieldConstants.notCollected
    }|>30|10-30|3-10|1-3|0.5-1|<0.5`,
  },
  {
    name: 'Cover of the most dominant stratum',
    description:
      'Foliage cover - proportion of ground cover which would be shaded if sunshine came directly overhead including branches and leaves.',
    datatype: 'text',
    allowedValues: `${
      obsFieldConstants.notCollected
    }|70-100%|30-70%|10-30%|<10%|~0% (scattered)|~0% (clumped)`,
  },
  {
    name: 'Vegetation community notes',
    description: '',
    datatype: 'text',
    allowedValues: '',
  },
  ...multiselect(
    'Evidence of disturbance and threats in the immediate area',
    '',
    'Chemical spray|Cultivation (incl. pasture/ag activities)|Dieback|Fire|Firewood/coarse woody debris removal|Grazing - feral (observed or scats) (i.e. rabbits, feral/escaped goats)|Grazing - native (observed or scats) (i.e. roo/possum scats)|Grazing - stock (observed or scats) (i.e. cattle, sheep, goat)|Mowing/slashing|Rubbish dumping (excluding small litter items)|Storm damage|Soil erosion (incl. run-off)|Trampling (human)|Vegetation clearance|Weed invasion|Other human disturbance',
  ),
  {
    name: 'Florivory damage noted',
    description: '',
    datatype: 'text',
    allowedValues: 'Not collected|Yes|No',
  },
  ...multiselect(
    'Floral visitors/potential pollinators observed',
    '',
    'Native bee|Introduced honey bee|Native wasp|Native fly|Fungus Gnat|Ant|Unknown insect|None Observed',
  ),
  // Floral visitors photo - not an obs field
  ...multiselect('Phenology; life stage status occurring', '', phenologyValues),
  {
    name: 'Phenology - dominant life stage status most occurring',
    description:
      'Which is the most dominant phenology amongst the individuals observed',
    datatype: 'text',
    allowedValues: `${obsFieldConstants.notCollected}|${phenologyValues}`,
  },
]

function multiselect(containerQuestionName, description, values) {
  return values.split('|').map(curr => ({
    name: `${containerQuestionName}${
      obsFieldConstants.multiselectSeparator
    }${curr}`,
    description,
    datatype: 'text',
    allowedValues: `${obsFieldConstants.noValue}|${obsFieldConstants.yesValue}`,
  }))
}

async function createObsField({ name, description, datatype, allowedValues }) {
  const form = new FormData()
  form.append(
    'observation_field[name]',
    obsFieldConstants.obsFieldNamePrefix + name,
  )
  form.append('observation_field[description]', description)
  form.append('observation_field[datatype]', datatype)
  form.append('observation_field[allowed_values]', allowedValues)
  form.append('authenticity_token', authenticityToken)
  form.append('utf8', '✓')
  try {
    const resp = await got.post(`${serverBaseUrl}/observation_fields`, {
      headers: {
        Cookie: `${sessionCookieKey}=${sessionCookieValue}`,
      },
      body: form,
    })
    console.warn(
      `[WARN] field with name='${name}' already exists (200 response code indicates this),` +
        ` it will NOT be updated. Delete and re-run!`,
    )
    return true
  } catch (err) {
    const isSuccess = err.statusCode === 302
    if (isSuccess) {
      return true
    }
    console.error(`[ERROR] failed to create obsField with name='${name}'`)
    process.exit(1)
  }
}

function requiredEnvVar(key) {
  const result = process.env[key]
  const isNotFound = typeof result === 'undefined'
  if (isNotFound) {
    const msg = `[ERROR] Required env var '${key}' is not found, cannot continue`
    if (isPrintOnly) {
      console.warn(msg)
    } else {
      throw new Error(msg)
    }
  }
  return result
}

;(async () => {
  // TODO could make idempotent by deleting all fields with matching namePrefix
  // first, although you cannot delete a field that is being used. Maybe look
  // at how the edit feature of the webpage works and emulate that.
  console.log(`[INFO] creating ${obsFields.length} fields`)
  for (const curr of obsFields) {
    console.log(`[INFO] processing name='${curr.name}'...`)
    if (isPrintOnly) {
      console.log('  ' + curr.allowedValues) // copy+paste friendly for manually updating fields
      continue
    }
    await createObsField(curr)
  }
  console.log('[INFO] Done, all fields created without error')
})()
