import {
  epiphyte,
  exact,
  multiselectSeparator,
  noValue,
  notCollected as notCollectedDefault,
  obsFieldNamePrefix,
  terrestrial,
  yesValue,
} from './obs-field-constants'

export { noValue, yesValue, multiselectSeparator }
// We *must* use VUE_APP_ as a prefix on the env vars, see for more details:
// https://cli.vuejs.org/guide/mode-and-env.html#using-env-variables-in-client-side-code

// If you need a way to update config *faster* than these value, have a look at
// reviving the code in commit b5e6cec5dae0e08cbc990442d4303a9bae940914. It
// pulls config from the server rather than relying on the user updating the
// app shell to see the new values.

// The URL of the API that we prepend to all our requests. Include the version
// path suffix, like https://api.inaturalist.com/v1
export const apiUrlBase = process.env.VUE_APP_API_BASE_URL

// URL of the iNat server that we prepend to all our requests. Something like
// https://inaturalist.com
export const inatUrlBase = process.env.VUE_APP_INAT_BASE_URL

export const appTitle = process.env.VUE_APP_TITLE

// Where the static assets for iNat are served from. For a dev server, it's
// probably the same at inatUrlBase. For the real inat, it's probably a CDN. To
// find out this value, load the iNat page of your choosing, and inspect the
// logo in the top-left and see what domain it's served from. If the logo URL
// is https://static.inaturalist.org/sites/1-logo.svg?1507246408
// ...then use https://static.inaturalist.org for this value
export const inatStaticUrlBase = process.env.VUE_APP_INAT_STATIC_BASE_URL

// Get this from the details page of your OAuth app.
// Find your app on <inat-server>/oauth/applications
export const appId = process.env.VUE_APP_OAUTH_APP_ID

// Get this on the same page as your appId. It's the URL that iNat will send
// the user back to (us)
export const redirectUri = process.env.VUE_APP_OAUTH_REDIRECT_URI

// The slug for the project that our app is tied to. If the full URL of the
// project is https://www.inaturalist.org/projects/wild-orchid-watch-australia
// then use wild-orchid-watch-australia for this value
export const inatProjectSlug = process.env.VUE_APP_INAT_PROJECT_SLUG

// set to 'production', 'beta' or 'development' so we can adapt to where we're deployed
export const deployedEnvName = process.env.VUE_APP_DEPLOYED_ENV_NAME

export const googleMapsApiKey = process.env.VUE_APP_GMAPS_API_KEY

// The tracker code for Google Analytics, e.g: UA-000000-1
export const googleAnalyticsTrackerCode = process.env.VUE_APP_GA_CODE

export const sentryDsn = process.env.VUE_APP_SENTRY_DSN

const assumedIdOfLifeTaxa = 1 // everything should have "Life" as an ancestor
// iNaturalist deals with much more taxa than what we're interested in. We only
// want orchids so we specify an integer ID (the ID in
// inaturalist.org/taxa/<ID>-Orchidaceae) here and we'll use it to filter species lists
// (like autocomplete) to only include taxa that have this node as an ancestor
export const targetTaxaNodeId = convertAndAssertInteger(
  process.env.VUE_APP_TARGET_TAXA_ID || assumedIdOfLifeTaxa,
)

export const countOfIndividualsObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_COUNT,
)

export const countOfIndividualsObsFieldDefault = 1

export const orchidTypeObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_ORCHID_TYPE,
)

export const widerLanduseObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_WIDER_LANDUSE,
)

export const soilStructureObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_SOIL_STRUCTURE,
)

export const conservationImmediateLanduseObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_IMMEDIATE_LANDUSE_CONSERVATION,
)

export const areaOfExactCountObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_AREA_OF_EXACT_COUNT,
)

export const areaOfPopulationObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_AREA_OF_POPULATION,
)

export const accuracyOfPopulationCountObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_ACCURACY_OF_POPULATION_COUNT,
)

// We need to show/hide other fields based on the orchid type. Here we define
// the values so we can match for them. Note: they must *exactly* match what is
// configured in iNat!
export const orchidTypeEpiphyte =
  process.env.VUE_APP_OBS_FIELD_ORCHID_TYPE_EPIPHYTE || epiphyte
export const orchidTypeTerrestrial =
  process.env.VUE_APP_OBS_FIELD_ORCHID_TYPE_TERRESTRIAL || terrestrial
export const accuracyOfCountExact =
  process.env.VUE_APP_OBS_FIELD_ACCURACY_EXACT || exact

export const notCollected =
  process.env.VUE_APP_NOT_COLLECTED || notCollectedDefault

export const hostTreeSpeciesObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_HOST_TREE,
)

export const phenologyObsFieldIds = parseFieldIdList(
  'VUE_APP_OBS_FIELD_IDS_PHENOLOGY',
  'phenology',
)

export const coarseFragmentsObsFieldIds = parseFieldIdList(
  'VUE_APP_OBS_FIELD_IDS_COARSE_FRAGMENTS',
  'coarse fragments',
)

export const immediateLanduseObsFieldIds = parseFieldIdList(
  'VUE_APP_OBS_FIELD_IDS_IMMEDIATE_LANDUSE',
  'immediate landuse',
)

export const evidenceThreatsObsFieldIds = parseFieldIdList(
  'VUE_APP_OBS_FIELD_IDS_EVIDENCE_THREATS',
  'evidence of threats',
)

export const mutuallyExclusiveMultiselectObsFieldIds = parseFieldIdList(
  'VUE_APP_OBS_FIELD_IDS_MUTUALLY_EXCLUSIVE_MULTISELECT',
  'mutually exclusive',
)

function parseFieldIdList(envVarKey, msgFragment) {
  const ids = process.env[envVarKey]
  if (!ids) {
    throw new Error(
      `Runtime config problem: no ${msgFragment} multiselect obs field IDs provided`,
    )
  }
  try {
    return JSON.parse(`[${ids}]`)
  } catch (err) {
    throw new Error(
      `Failed while parsing ${msgFragment} multiselect IDs from env var: ` +
        err.message,
    )
  }
}

export const coarseFragmentsMultiselectId = 'coarseFragmentsMultiselect'
export const evidenceThreatsMultiselectId = 'evidenceThreatsMultiselect'
export const immediateLanduseMultiselectId = 'immediateLanduseMultiselect'
export const phenologyMultiselectId = 'phenologyMultiselect'

export function getMultiselectId(fieldId) {
  const multiselectIdMapping = {
    [coarseFragmentsObsFieldIds]: coarseFragmentsMultiselectId,
    [evidenceThreatsObsFieldIds]: evidenceThreatsMultiselectId,
    [immediateLanduseObsFieldIds]: immediateLanduseMultiselectId,
    [phenologyObsFieldIds]: phenologyMultiselectId,
  }
  const found = Object.entries(multiselectIdMapping).find(e =>
    e[0].includes(fieldId),
  )
  return (found || [])[1]
}

export const epiphyteHeightObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_EPIPHYTE_HEIGHT,
)

export const approxAreaSearchedObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_AREA_SEARCHED,
)

export const obsPageSize = convertAndAssertInteger(
  process.env.VUE_APP_OBS_PAGE_SIZE || 100,
)

export const obsFieldSeparatorChar = process.env.VUE_APP_OBS_FIELD_SEP || '|'

export const obsFieldPrefix =
  process.env.VUE_APP_OBS_FIELD_PREFIX || obsFieldNamePrefix

export const appVersion = process.env.VUE_APP_VERSION || 'live.dev'

// More "constant" constants from here on

export const noImagePlaceholderUrl = '/img/no-image-placeholder.png'

export const noProfilePicPlaceholderUrl = 'img/no-profile-pic-placeholder-3.png'

export const onboarderComponentName = 'Onboarder'

export const oauthCallbackComponentName = 'OauthCallback'

export const alwaysUpload = 'ALWAYS'
export const neverUpload = 'NEVER'

export const persistedStateLocalStorageKey = 'wow-vuex'

export const lfWowObsStoreName = 'wow-obs'

export const recordProcessingOutcomeFieldName = 'recordProcessingOutcome'

export const beginner = 'BEGINNER'
export const expert = 'EXPERT'

export const notSupported = 'NOT_SUPPORTED'
export const blocked = 'BLOCKED'
export const failed = 'FAILED'

export const obsFieldName = 'obs'
export const recordTypeFieldName = 'recordType'
export const photosFieldName = 'photos'
export const photoIdsToDeleteFieldName = 'photos-delete'
export const photosToAddFieldName = 'photos-add'
export const obsFieldIdsToDeleteFieldName = 'obsFields-delete'
export const obsFieldsFieldName = 'obsFields'
export const projectIdFieldName = 'projectId'
export const blockedActionFieldName = 'blockedAction'
export const hasBlockedActionFieldName = 'hasBlockedAction'
export const isEventuallyDeletedFieldName = 'isEventuallyDeleted'

export const syncDepsQueueMsg = 'SYNC_DEPS_QUEUE'
export const syncObsQueueMsg = 'SYNC_OBS_QUEUE'
export const refreshObsMsg = 'REFRESH_OBS'
export const skipWaitingMsg = 'SKIP_WAITING'

// Record processing outcomes
export const waitingOutcome = 'waiting' // waiting to be processed
export const withLocalProcessorOutcome = 'withLocalProcessor' // we're actively processing it
export const withServiceWorkerOutcome = 'withServiceWorker' // we've processed it, but haven't heard back from SW yet
export const successOutcome = 'success' // successfully processed
export const userErrorOutcome = 'userError' // processed but encountered an error the user can fix
export const systemErrorOutcome = 'systemError' // processed but encountered an error the user CANNOT fix

const serviceWorkerMagicUrlPrefix = 'https://local.service-worker'
export const serviceWorkerBundleMagicUrl =
  serviceWorkerMagicUrlPrefix + '/queue/obs-bundle'
export const serviceWorkerIsAliveMagicUrl =
  serviceWorkerMagicUrlPrefix + '/are-you-alive'
export const serviceWorkerUpdateAuthHeaderUrl =
  serviceWorkerMagicUrlPrefix + '/update-auth-header'

export const wowUuidCustomHttpHeader = 'x-wow-uuid'

function convertAndAssertInteger(val) {
  const result = parseInt(val)
  if (isNaN(result)) {
    throw new Error(
      `Runtime config problem: expected integer is not a number='${val}'`,
    )
  }
  return result
}
