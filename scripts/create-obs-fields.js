// Creates all of our observation fields in an iNaturalist server.
//
// During dev we need to re-create them semi-often so this makes life easier.
// It can also streamline updates.
//
// Run with something like:
// $ WOW_SESSION_VALUE=5c0b232a94ea34a4a21e648b607f6593 \
//     WOW_AUTHENTICITY_TOKEN='n1wN6vpq4sHoEQkzIz9EHJEhHa+XmWzs5lcEK7xDBuW9kwk4MUxjO3LGlK/9WsNbqCRS6+8EnmiALTFUTDB2wQ==' \
//     node ./create-obs-fields.js
//
// See below for how to get an authenticity token
const got = require('got') // something else pulls this in so we'll use it
const FormData = require('form-data')

const namePrefix = 'WOW '

// *YOU* need to config these values \/
const serverBaseUrl = process.env.WOW_SERVER || 'https://dev.inat.techotom.com'
const sessionCookieKey = process.env.WOW_SESSION_KEY || '_yoursite_session'

// Use chrome dev tools to pull this out of an active session with iNat
// example session value = '5c0b232a94ea34a4a21e648b607f6593'
const sessionCookieValue = requiredEnvVar('WOW_SESSION_VALUE')

// we're pretending to do a POST from a web page so we need the CSRF protection
// token. Lucky Rails seems to accept the same token repeatedly so we can get
// one once and keep using it. Get it with something like (uncomment it):

// console.log(`curl -s '${serverBaseUrl}/observation_fields/new' \
//   -H 'accept: text/html' \
//   -H 'cookie: ${sessionCookieKey}=${sessionCookieValue}' \
//   | grep -A 1 'csrf.*authenticity' | tail -n 1 | sed 's/.*content="\\(.*\\)".*/\\1/'`)
// process.exit()

// example auth token = 'nM6DtXsURZsm96E3S8w4M6E53LX7wkFKUx0+u2/43C6+AYdnsDLEYbwgPKuVqb90mDyT8YNfs841ZwvEn4usCg=='
const authenticityToken = requiredEnvVar('WOW_AUTHENTICITY_TOKEN')
// *YOU* need to config these values /\

const obsFields = [
  {
    name: 'Orchid type',
    description: '',
    datatype: 'text',
    allowedValues: 'Epiphyte|Terrestrial|Lithophyte',
  },
  {
    name: 'Altitude metres',
    description:
      'Altitude (in metres), compared to sea level, that observation was made at',
    datatype: 'numeric',
    allowedValues: '',
  },
  {
    name: 'Surrounding land use',
    description: 'Categorise the immediate area surrounding the observation',
    datatype: 'text',
    allowedValues:
      'Conservation and natural environments|Production from relatively natural environments|Production from dryland agriculture and plantations|Production from irrigated agriculture plantations|Intensive uses|Water',
  },
  {
    name: 'Is surrounded by litter',
    description: '',
    datatype: 'text',
    allowedValues: 'Yes|No',
  },
  {
    name: 'Host tree species',
    description:
      'Species of the host that this orchid grows on. Only required for Orchid Type = Epiphyte',
    datatype: 'taxon',
    allowedValues: '',
  },
  {
    name: 'Epiphyte height (cm)',
    description: 'Only required for Orchid Type = Epiphyte',
    datatype: 'numeric',
    allowedValues: '',
  },
  {
    name: 'Landform element',
    description: '',
    datatype: 'text',
    allowedValues:
      'Plain|Playa/Pan|Lunette|Breakaway|Drainage depression|Dune|Dune crest|Dune slope|Swale|Hill crest|Hill slope|Gully|Cliff|Scarp|Stream channel|Floodout|Fan-alluvial|Lake|Swamp',
  },
  {
    name: 'Soil texture',
    description: '',
    datatype: 'text',
    allowedValues: 'Sand|Loam|Clay|Sandy-loam|Loamy-clay|Gravel|Rocky',
  },
  {
    name: 'Vegetation community notes',
    description: '',
    datatype: 'text',
    allowedValues: '',
  },
  {
    name: 'Sign of disturbance and threats',
    description: '',
    datatype: 'text',
    allowedValues:
      'Clearing (vegetation clearance)|Clearing – mowing/slashing|Chemical spray (incl. spray drift)|Cultivation (incl. pasture/ag activities)|Soil erosion (incl. run-off)|Firewood/coarse woody debris removal|Grazing (stock species, presence of sheep/cattle scats)|Grazing (native species, presence of roo/possum scats)|Fire|Storm damage|Weed invasion|Foot trampling (human)|Other human disturbance (e.g. car parking)|Not Applicable',
  },
  {
    name: 'Phenology',
    description: '',
    datatype: 'text',
    allowedValues:
      'Vegetative|Bud|Flower|Senescent flower|Developing fruit|Senescent fruit',
  },
  {
    name: 'Floral visitors observed',
    description: '',
    datatype: 'text',
    allowedValues:
      'Native bee|Native wasp|Native fly|Fungus Gnat|Ant|Unknown insect|None Observed',
  },
  {
    name: 'Damaged flowers',
    description: '',
    datatype: 'text',
    allowedValues: 'Yes|No',
  },
  {
    name: 'Deheaded flowers',
    description: '',
    datatype: 'text',
    allowedValues: 'Yes|No',
  },
  {
    name: 'Count of individuals recorded',
    description:
      'How many individual organisms did you observe? Only required when observing more than one individual',
    datatype: 'numeric',
    allowedValues: '',
  },
  {
    name: 'Accuracy of count',
    description:
      'How accurate is the count of indiviudals recorded. Only required when observing more than one individual',
    datatype: 'text',
    allowedValues: 'Exact|Estimate',
  },
  {
    name: 'Approx area searched m2',
    description:
      'How large is the area you searched while counting individuals? Only required when observing more than one individual',
    datatype: 'text',
    allowedValues: '1|10|50|100|>101',
  },
]

async function createObsField({ name, description, datatype, allowedValues }) {
  const form = new FormData()
  form.append('observation_field[name]', namePrefix + name)
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
    throw new Error(
      `[ERROR] Required env var '${key}' is not found, cannot continue`,
    )
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
    await createObsField(curr)
  }
  console.log('[INFO] Done, all fields created without error')
})()
