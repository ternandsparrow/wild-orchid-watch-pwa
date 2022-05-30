#!/usr/bin/env node
// creates obs fields on a target iNaturalist instance.
// This script is NOT idempotent. But then you'll be only using it once so it's
// good enough for that purpose.
const obsFieldConstants = require('../src/misc/obs-field-constants')

const isPrintOnly = !!process.env.PRINTONLY
const isMakeHttpie = !!process.env.WOW_MAKE_HTTPIE

// Creates all of our observation fields in an iNaturalist server.
//
// During dev we need to re-create them semi-often so this makes life easier.
// Right now it can't do updates but that is something that could be added.
//
// Run with something like:
// $ WOW_SESSION_KEY='_devinat_session' \
//     WOW_SERVER='https://dev.inat.techotom.com' \
//     WOW_SESSION_VALUE=5c0b232a94ea34a4a21e648b607f6593 \
//     WOW_AUTHENTICITY_TOKEN='n1wN6vpq4sHoEQkzIz9EHJEhHa+XmWzs5lcEK7xDBuW9kwk4MUxjO3LGlK/9WsNbqCRS6+8EnmiALTFUTDB2wQ==' \
//     node ./create-obs-fields.js
//
// See below for how to get an authenticity token
const got = require('got') // something else pulls this in so we'll use it
const FormData = require('form-data')

// *YOU* need to config these values \/
// at time of writing 'https://www.inaturalist.org' works for prod (that www.
// is important)
const serverBaseUrl = process.env.WOW_SERVER || 'https://dev.inat.techotom.com'
console.log(`Using WOW_SERVER=${serverBaseUrl}`)

// Use your browser dev tools to pull these Cookie details out of an active
// session with iNat.  The cookie name is named after the Rails site that you
// configure so at the time of writing the prod inat (inaturalist.org) uses
// _inaturalist_session and our dev server uses _devinat_session.
// example session cookie name = '_devinat_session'
const sessionCookieName = requiredEnvVar('WOW_SESSION_KEY')
// example session cookie value = '5c0b232a94ea34a4a21e648b607f6593'
const sessionCookieValue = requiredEnvVar('WOW_SESSION_VALUE')

console.log(`Using WOW_SESSION_KEY=${sessionCookieName}`)
console.log(`Using WOW_SESSION_VALUE=${sessionCookieValue}`)

// we're pretending to do a POST from a web page so we *need* the CSRF protection
// token. Lucky Rails seems to accept the same token repeatedly so we can get
// one once and keep using it. You can get an auth token by uncommenting the
// following fragment then running this script (and providing all env vars
// except the auth token). The output will be a bash script that you need to
// copy+paste and run. Remember to comment again so you can create the obs
// fields.

// example auth token = 'nM6DtXsURZsm96E3S8w4M6E53LX7wkFKUx0+u2/43C6+AYdnsDLEYbwgPKuVqb90mDyT8YNfs841ZwvEn4usCg=='
const authTokenEnvVarKey = 'WOW_AUTHENTICITY_TOKEN'
const authenticityToken = process.env[authTokenEnvVarKey]

if (!authenticityToken) {
  console.error('\nNO AUTHENTICITY TOKEN supplied!')
  console.error(
    'Generating bash script to help you get it. Run the following script:\n',
  )
  console.log(`curl --silent --location \\
  '${serverBaseUrl}/observation_fields/new' \\
  -H 'accept: text/html' \\
  -H 'cookie: ${sessionCookieName}=${sessionCookieValue}' \\
  | grep -A 1 'csrf.*authenticity' \\
  | tail -n 1 \\
  | sed 's/.*content="\\(.*\\)".*/\\1/' \\
  | grep . --colour=never || echo "ERROR no authenticity token found in HTML"
  `)
  console.error(
    `\nOnce you have the token, run this node script again and set the ` +
      `${authTokenEnvVarKey} env var to the auth token you got from the bash ` +
      `script above.`,
  )
  process.exit(1)
}
if (authenticityToken.length !== 88) {
  console.error(
    `[ERROR] authenticity token doesn't look right. Expected a base64 ` +
      `looking string that is 88 characters long, got ` +
      `value='${authenticityToken}' with length=${authenticityToken.length}. ` +
      `Has the value been percent escaped accidentally?`,
  )
  process.exit(1)
}
console.log(`Using WOW_AUTHENTICITY_TOKEN=${authenticityToken}`)
// *YOU* need to config these values /\

const commonLanduses =
  'Production from relatively natural environments|Production from dryland agriculture and plantations|Production from irrigated agriculture plantations|Intensive uses|Water'
const linearAreas = `2|4|10|16|24|36|42|50|64|72|100|>100`
const phenologyValues =
  'Vegetative|Budding|Flowering|Senescent flower|Developing fruit|Senescent fruit'

const obsFields = [
  // Georeferenced location - not an obs field
  // Date - not an obs field
  // Time - not an obs field
  // Orchid photos - not an obs field
  //  - whole plant (required)
  //  - flower
  //  - leaf
  //  - fruit
  // Habitat photos - not an obs field
  //  - habitat, site photo ~5m either side of plant (required)
  //  - microhabitat, downward looking photo ~30cm either side of plant (required)
  //  - canopy, looking upward from flower height (or chest)
  // Floral visitors photo - not an obs field
  // Host tree photo - not an obs field
  // Species name or your descriptive field name - not an obs field
  {
    name: 'Orchid type',
    description: '',
    datatype: 'text',
    allowedValues: `${obsFieldConstants.terrestrial}|${obsFieldConstants.epiphyte}|Lithophyte`,
  },
  {
    name: 'Host tree species',
    description: `Species of the host that this orchid grows on. Only required for Orchid Type = ${obsFieldConstants.epiphyte}`,
    datatype: 'taxon',
    allowedValues: '',
  },
  {
    name: 'Epiphyte height on the host (m)',
    description: `Estimate the number of metres above ground level the orchid is growing on the host plant. Only required for Orchid Type = ${obsFieldConstants.epiphyte}`,
    datatype: 'text',
    allowedValues: `1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|>15`,
  },
  {
    name: 'Is the plant surrounded by litter',
    description: '',
    datatype: 'text',
    allowedValues: 'Not collected|Yes|No',
  },
  {
    name: 'Landform type',
    description: '',
    datatype: 'text',
    allowedValues: `${obsFieldConstants.notCollected}|Crest|Hill (hillock)|Ridge|Slope - unspecified|Slope - simple|Slope - mid|Slope - lower|Flat|Open depression|Closed depression`,
  },
  {
    name: 'Soil structure as observed from the surface',
    description: 'Used as an indication, NO DIGGING ALLOWED!',
    datatype: 'text',
    allowedValues: `${obsFieldConstants.notCollected}|Unknown|Sand - felt or heard when pinching|Loam|Clay`,
  },
  ...multiselect(
    'Rock cover size',
    '',
    'None|Fine gravel or small pebbles <6 mm|Medium gravel to medium pebbles 6 - 20 mm|Coarse gravel to large pebbles 20 - 60 mm|Cobbles 60 - 200 mm|Stones 200 - 600 mm|Boulders 600 - 2000 mm|Large boulders >2000 mm',
  ),
  {
    name: 'Accuracy of population count',
    description: 'How accurate is the count of individuals recorded.',
    datatype: 'text',
    allowedValues: `${obsFieldConstants.exact}|Partial count|Extrapolated/Estimate`,
  },
  {
    name: 'Number of individuals recorded',
    description: 'How many individual orchids did you observe?',
    datatype: 'numeric',
    allowedValues: '',
  },
  {
    name: 'Search effort (minutes)',
    description:
      'Time spent surveying: minutes actively searching (not just time at the location doing other tasks) i.e. 2 people for 30 minutes = 60 minutes',
    datatype: 'text',
    allowedValues: `${obsFieldConstants.notCollected}|<1|a few minutes|5|10|15|20|30|45|60|90|120|120+`,
  },
  {
    name: 'Accuracy of search area calculation',
    description: 'How accurate is your calculation of the area searched?',
    datatype: 'text',
    allowedValues: `${obsFieldConstants.notCollected}|${obsFieldConstants.precise}|${obsFieldConstants.estimated}`,
  },
  {
    name: 'Precise area measurements - length (m)',
    description: 'Length, in metres, of your precisely measured area',
    datatype: 'numeric',
    allowedValues: '',
  },
  {
    name: 'Precise area measurements - width (m)',
    description: 'Width, in metres, of your precisely measured area',
    datatype: 'numeric',
    allowedValues: '',
  },
  {
    name: 'Estimated area searched (m²)',
    description:
      'How large is the area you searched while counting individuals? Only required when observing more than one individual. Recommended linear searches i.e. rectangles along paths, etc',
    datatype: 'text',
    allowedValues: `${obsFieldConstants.notCollected}|${linearAreas}`,
  },
  {
    name: 'Area of population (m²)',
    description: 'Only applicable when recording >1 individual',
    datatype: 'text',
    allowedValues: `less than 1|1|${linearAreas}`,
  },
  ...multiselect('Phenology; life stage status occurring', '', phenologyValues),
  {
    name: 'Phenology - dominant life stage status most occurring',
    description:
      'Which is the most dominant phenology amongst the individuals observed',
    datatype: 'text',
    allowedValues: `${obsFieldConstants.notCollected}|${phenologyValues}`,
  },
  {
    name: 'Florivory damage noted',
    description:
      'Please indicate if there is damage to the orchid caused by animals or insects eating the flower(s).',
    datatype: 'text',
    allowedValues: 'Not collected|Yes|No',
  },
  ...multiselect(
    'Floral visitors/potential pollinators observed',
    '',
    'Native bee|Introduced honey bee|Native wasp|Fly|Fungus Gnat|Ant|Unknown insect|None Observed',
  ),
  {
    name: 'Dominant vegetation growth form',
    description: '',
    datatype: 'text',
    allowedValues: [
      obsFieldConstants.notCollected,
      'Unknown',
      'Tree',
      'Shrub',
      'Shrub - heath',
      'Shrub - chenopod',
      'Grass-tree',
      'Grass - not specified',
      'Grass - tussock',
      'Grass - hummock (i.e. spinifex)',
      'Mallee tree',
      'Mallee shrub',
      'Sedge',
      'Samphire shrub',
      'Rush',
      'Forb',
      'Tree-fern',
      'Fern',
      'Vine',
      'Palm',
      'Cycad',
    ].join('|'),
  },
  {
    name: 'Height of the most dominant growth form present (metres)',
    description:
      'Maximum height of the dominant vegetation layer, i.e. for forests/woodlands, height of the tallest trees; for shrublands, height of the shrub layer',
    datatype: 'text',
    allowedValues: `${obsFieldConstants.notCollected}|>30|10-30|3-10|1-3|0.5-1|<0.5`,
  },
  {
    name: 'Foliage cover of the most dominant vegetation layer (lower storey, mid storey or upper storey)',
    description:
      'The proportion of the ground, which would be shaded by branches and leaves, if sunshine came from directly overhead.',
    datatype: 'text',
    allowedValues: `${obsFieldConstants.notCollected}|70-100%|30-70%|10-30%|<10%|~0% (scattered)|~0% (clumped)`,
  },
  {
    name: 'Vegetation community notes',
    description:
      'Please add additional information, such as genera/species of the dominant plants present.',
    datatype: 'text',
    allowedValues: '',
  },
  {
    name: 'Landuse of the immediate area',
    description: 'Categorise the immediate area surrounding the observation',
    datatype: 'text',
    allowedValues: `${obsFieldConstants.notCollected}|${obsFieldConstants.conservationLanduse}|${commonLanduses}`,
  },
  {
    name: 'Wider landuse',
    description: `Categorise the wider area surrounding the observation. Only required when immediate landuse = ${obsFieldConstants.conservationLanduse}`,
    datatype: 'text',
    allowedValues: `${commonLanduses}|Unknown`,
  },
  ...multiselect(
    'Evidence of disturbance and threats in the immediate area',
    '',
    [
      'None observed',
      'Vegetation clearance',
      'Mowing/slashing',
      'Rubbish dumping',
      'Chemical spray',
      'Cultivation',
      'Dieback',
      'Soil erosion',
      'Firewood/coarse woody debris removal',
      'Grazing (feral, i.e.rabbits, goats)',
      'Grazing (stock present or scats)',
      'Grazing (native species, presence of roo/possum scats)',
      'Fire ',
      'Storm damage',
      'Weed invasion',
      'Foot trampling (human)',
      'Other human disturbance',
    ].join('|'),
  ),
]

function multiselect(containerQuestionName, description, values) {
  return values.split('|').map((curr) => ({
    name: `${containerQuestionName}${obsFieldConstants.multiselectSeparator}${curr}`,
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
        Cookie: `${sessionCookieName}=${sessionCookieValue}`,
      },
      body: form,
    })
    console.warn(
      `[WARN] field with name='${name}' already exists (200 response code indicates this),` +
        ` it will NOT be updated. Delete and re-run!`,
    )
    return true
  } catch (err) {
    const respBody = err.response.body || ''
    const isBeingRedirectedToSignin = respBody.includes('sign_in">redirected')
    const sc = err.statusCode
    const isSuccess = sc === 302
    if (isSuccess && !isBeingRedirectedToSignin) {
      console.info(`Success, status code = ${sc}`)
      return true
    }
    const msg = (() => {
      const baseMsg = `[ERROR] failed to create obsField with name='${name}'.`
      if (isBeingRedirectedToSignin) {
        return (
          `${baseMsg} It looks like we're being redirected to sign in. Make sure you ` +
          `session is still alive and that you're using the server URL it ` +
          `wants to serve under, e.g. using inaturalist.org when it wants ` +
          `you to use www.inaturalist.org`
        )
      }
      return `${baseMsg} HTTP status code = ${sc}, start of response body is:${respBody.substring(
        0,
        200,
      )}`
    })()
    console.error(msg)
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
  console.log(`#[INFO] creating ${obsFields.length} fields`)
  for (const curr of obsFields) {
    console.log(`#[INFO] processing name='${curr.name}'...`)
    if (isPrintOnly) {
      // copy+paste friendly for manually updating fields
      console.log(`  ${curr.allowedValues}`)
      continue
    }
    if (isMakeHttpie) {
      // fall back to generating bash script that runs httpie
      console.log(`http \\
        --form \\
        ${serverBaseUrl}/observation_fields \\
        Cookie:${sessionCookieName}=${sessionCookieValue} \\
        'observation_field[name]=${
          obsFieldConstants.obsFieldNamePrefix + curr.name
        }' \\
        'observation_field[description]=${curr.description}' \\
        'observation_field[datatype]=${curr.datatype}' \\
        'observation_field[allowed_values]=${curr.allowedValues}' \\
        'authenticity_token=${authenticityToken}' \\
        'utf8=✓'
      `)
      continue
    }
    await createObsField(curr)
  }
  console.log(
    '[INFO] note that for the iNat project to see any changes to obs fields, ' +
      'you need to edit and save it (even if you change nothing). This will ' +
      'make the project "re-read" the obs fields otherwise it seems to ' +
      'continue to serve up a cached, stale copy of the project info.',
  )
  console.log('[INFO] Done, all fields created without error')
})()
