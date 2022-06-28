import {
  conservationLanduse,
  epiphyte,
  estimated,
  exact,
  multiselectSeparator,
  noValue,
  notCollected as notCollectedDefault,
  obsFieldNamePrefix,
  precise,
  terrestrial,
  yesValue,
} from './obs-field-constants'

export {
  conservationLanduse,
  multiselectSeparator,
  noValue,
  obsFieldNamePrefix,
  yesValue,
}

// We *must* use VUE_APP_ as a prefix on the env vars, see for more details:
// https://cli.vuejs.org/guide/mode-and-env.html#using-env-variables-in-client-side-code

// If you need a way to update config *faster* than these value, have a look at
// reviving the code in commit b5e6cec5dae0e08cbc990442d4303a9bae940914. It
// pulls config from the server rather than relying on the user updating the
// app shell to see the new values.

// The URL of the API (implemented with NodeJS at time of writing) that we
// prepend to all our requests. Include the version path suffix, like
// https://api.inaturalist.com/v1
export const apiUrlBase = process.env.VUE_APP_API_BASE_URL

// The URL of our WOW facade
// (https://github.com/ternandsparrow/wild-orchid-watch-api-facade)
export const facadeUrlBase = process.env.VUE_APP_FACADE_BASE_URL

// URL of the Ruby on Rails iNaturalist server that we prepend to all our
// requests. Something like https://inaturalist.com
export const inatUrlBase = process.env.VUE_APP_INAT_BASE_URL

// Where the static assets for iNat are served from. For a sandbox/dev iNat
// instance, it's probably the same at inatUrlBase. For the real iNat, it's
// probably a CDN. To find out this value, load the iNat page of your choosing,
// and inspect the logo in the top-left and see what domain it's served from.
// If the logo URL is
//   https://static.inaturalist.org/sites/1-logo.svg?1507246408
// ...then use
//   https://static.inaturalist.org
// for this value
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

// Google Cloud Platform API keys. You can use the same key for both. Maps is
// specifically the "Maps JavaScript API" and errors is "Stackdriver Error
// Reporting API".
export const googleMapsApiKey = process.env.VUE_APP_GMAPS_API_KEY
export const googleErrorsApiKey =
  process.env.VUE_APP_GCP_ERRORS_API_KEY || googleMapsApiKey

// The tracker code for Google Analytics, e.g: UA-000000-1
export const googleAnalyticsTrackerCode = process.env.VUE_APP_GA_CODE

// Sentry.io is an error tracker. You probably don't want this on for most
// local dev as there's not much point reporting the numerous errors seen
// during local dev and often Sentry will swallow the error so it makes
// debugging harder (see https://github.com/vuejs/vue/issues/8433). Of course
// at some stage you'll need to test that errors are reported as you expect to
// Sentry. DSN values look like a URL:
//   https://o1111111111111111111111111111111@o222222.ingest.sentry.io/3333333
export const sentryDsn = process.env.VUE_APP_SENTRY_DSN

export const frequencyOfTaskChecksSeconds = convertAndAssertInteger(
  process.env.VUE_APP_TASK_CHECK_FREQ || 20,
)

// The URL where we can load the taxa list for populating the orchid
// autocomplete. See scripts/build-taxa-index.js for more details.
export const taxaDataUrl =
  process.env.VUE_APP_TAXA_DATA_URL || '/wow-taxa-index.json'

export const maxSpeciesAutocompleteResultLength = convertAndAssertInteger(
  process.env.VUE_APP_MAX_SPECIES_AUTOCOMPLETE_LENGTH || 50,
)

export const waitBeforeRefreshSeconds = convertAndAssertInteger(
  process.env.VUE_APP_WAIT_BEFORE_REFRESH_SECONDS || 1,
)

// this is the max number of *failures*. It will get one more chance than this
// number so n = 3 will have the request made 4 times.
export const maxReqFailureCountInSw = convertAndAssertInteger(
  process.env.VUE_APP_MAX_SW_REQ_FAIL_COUNT || 3,
)

// the retention time of the background-sync workbox queues in the service
// worker. Once a request is over this threshold, it will *not* be processed
export const swQueueMaxRetentionMinutes = convertAndAssertInteger(
  process.env.VUE_APP_SW_QUEUE_MAX_RETENTION || 365 * 24 * 60, // one year
)

// how many minutes need to have elapsed before we can consider an obs as stuck
// with the service worker. Set to 0 to disable check completely.
export const thresholdForStuckWithSwMinutes = convertAndAssertInteger(
  process.env.VUE_APP_STUCK_WITH_SW_MINUTES || 20,
)

// useful for enabling devtools in "production mode" while debugging with a
// service worker
export const isForceVueDevtools = !!parseInt(
  process.env.VUE_APP_FORCE_VUE_DEVTOOLS || 0,
  10,
)

export const isEnableWorkboxLogging = parseBoolean(
  process.env.VUE_APP_ENABLE_WORKBOX_LOGGING,
)

// Feature flags, so we can work on things but not have them show up in all
// environments until we're ready
export const isMissionsFeatureEnabled = parseBoolean(
  process.env.VUE_APP_FEATURE_FLAG_MISSIONS,
)

export const isNewsFeatureEnabled = parseBoolean(
  process.env.VUE_APP_FEATURE_FLAG_NEWS,
)

export const isDraftFeatureEnabled = parseBoolean(
  process.env.VUE_APP_FEATURE_FLAG_DRAFT,
)

export const isBugReportFeatureEnabled = parseBoolean(
  process.env.VUE_APP_FEATURE_FLAG_BUG_REPORT,
)

// IDs of things in iNat so we know how to handle things correctly

export const countOfIndividualsObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_COUNT,
)

export const orchidTypeObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_ORCHID_TYPE,
)

export const widerLanduseObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_WIDER_LANDUSE,
)

export const soilStructureObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_SOIL_STRUCTURE,
)

export const immediateLanduseObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_IMMEDIATE_LANDUSE,
)

export const areaOfPopulationObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_AREA_OF_POPULATION,
)

export const accuracyOfPopulationCountObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_ACCURACY_OF_POPULATION_COUNT,
)

export const accuracyOfSearchAreaCalcObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_ACCURACY_OF_SEARCH_AREA_CALC,
)

export const searchAreaCalcPreciseLengthObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_SEARCH_AREA_CALC_PRECISE_LENGTH,
)

export const searchAreaCalcPreciseWidthObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_SEARCH_AREA_CALC_PRECISE_WIDTH,
)

export const searchEffortObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_SEARCH_EFFORT,
)

export const litterObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_LITTER,
)

export const landformTypeObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_LANDFORM_TYPE,
)

export const dominantPhenologyObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_DOMINANT_PHENOLOGY,
)

export const florivoryDamageObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_FLORIVORY_DAMAGE,
)

export const dominantVegObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_DOMINANT_VEG,
)

export const heightOfDominantVegObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_HEIGHT_OF_DOMINANT_VEG,
)

export const coverOfDominantStratumObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_COVER_OF_DOMINANT_STRATUM,
)

export const communityNotesObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_COMMUNITY_NOTES,
)

export const hostTreeSpeciesObsFieldId = convertAndAssertInteger(
  process.env.VUE_APP_OBS_FIELD_ID_HOST_TREE,
)

// These values are unlikely to ever change. You can see the linkage to the
// script that creates the obs fields and assuming it all stays in sync,
// everyone is happy. If the obs fields get edited in the future (generally not
// a good idea), then it may be necessary to override some of these values.
// This is purely to make that (painful) job easier.
export const orchidTypeEpiphyte =
  process.env.VUE_APP_OBS_FIELD_ORCHID_TYPE_EPIPHYTE || epiphyte
export const orchidTypeTerrestrial =
  process.env.VUE_APP_OBS_FIELD_ORCHID_TYPE_TERRESTRIAL || terrestrial
export const accuracyOfSearchAreaCalcPrecise =
  process.env.VUE_APP_OBS_FIELD_ACCURACY_PRECISE || precise
export const accuracyOfSearchAreaCalcEstimated =
  process.env.VUE_APP_OBS_FIELD_ACCURACY_ESTIMATED || estimated
export const countOfIndividualsObsFieldDefault =
  process.env.VUE_APP_OBS_FIELD_COUNT_DEFAULT || 1
export const accuracyOfPopulationCountObsFieldDefault = exact
export const notCollected =
  process.env.VUE_APP_NOT_COLLECTED || notCollectedDefault

// these following field IDs values are comma separated lists of ID that will
// be grouped and displayed as a mutliselect in the UI. This is the make them
// easier for the user to interact with.

export const phenologyObsFieldIds = parseFieldIdList(
  'VUE_APP_OBS_FIELD_IDS_PHENOLOGY',
  'phenology',
)

// the terminology changed from "coarse fragments" to "rock cover" but there
// hasn't been time to refactor all the variable names yet
export const coarseFragmentsObsFieldIds = parseFieldIdList(
  'VUE_APP_OBS_FIELD_IDS_COARSE_FRAGMENTS',
  'rock cover',
)

export const floralVisitorsObsFieldIds = parseFieldIdList(
  'VUE_APP_OBS_FIELD_IDS_FLORAL_VISITORS',
  'floral visitors',
)

export const evidenceThreatsObsFieldIds = parseFieldIdList(
  'VUE_APP_OBS_FIELD_IDS_EVIDENCE_THREATS',
  'evidence of threats',
)

// these field IDs will become mutually exclusive with all other values in the
// multiselect.
export const mutuallyExclusiveMultiselectObsFieldIds = parseFieldIdList(
  'VUE_APP_OBS_FIELD_IDS_MUTUALLY_EXCLUSIVE_MULTISELECT',
  'mutually exclusive',
)

// some browsers don't know how to word wrap long values in <select>s (looking
// at you Samsung Internet and iOS Safari). To work around this, field IDs
// listed here will be forced into a radiogroup instead, so we can control the
// word wrapping
export const wideSelectObsFieldIds = parseFieldIdList(
  'VUE_APP_OBS_FIELD_IDS_WIDE_SELECTS',
  'wide select fields',
)

function parseFieldIdList(envVarKey, msgFragment) {
  const ids = process.env[envVarKey]
  if (!ids) {
    const err = new Error(
      `Runtime config problem: no ${msgFragment} multiselect obs field IDs provided`,
    )
    err.name = 'WowError'
    throw err
  }
  try {
    return JSON.parse(`[${ids}]`)
  } catch (err) {
    throw new Error(
      `Failed while parsing ${msgFragment} multiselect IDs from env var: ${err.message}`,
    )
  }
}

export const coarseFragmentsMultiselectId = 'coarseFragmentsMultiselect'
export const evidenceThreatsMultiselectId = 'evidenceThreatsMultiselect'
export const floralVisitorsMultiselectId = 'floralVisitorsMultiselect'
export const phenologyMultiselectId = 'phenologyMultiselect'

export function getMultiselectId(fieldId) {
  const multiselectIdMapping = {
    [coarseFragmentsObsFieldIds]: coarseFragmentsMultiselectId,
    [evidenceThreatsObsFieldIds]: evidenceThreatsMultiselectId,
    [floralVisitorsObsFieldIds]: floralVisitorsMultiselectId,
    [phenologyObsFieldIds]: phenologyMultiselectId,
  }
  const found = Object.entries(multiselectIdMapping).find((e) =>
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

export const swQueuePeriodicTrigger = convertAndAssertInteger(
  process.env.VUE_APP_SW_PERIODIC_SYNC || 30, // seconds
)

export const bboxLatMin = convertAndAssertFloat(
  process.env.VUE_APP_BBOX_LAT_MIN || -55,
)

export const bboxLatMax = convertAndAssertFloat(
  process.env.VUE_APP_BBOX_LAT_MAX || -10,
)

if (bboxLatMin >= bboxLatMax) {
  const msg =
    `Config problem: bboxLatMin=${bboxLatMin} is NOT less than ` +
    `bboxLatMax=${bboxLatMax}`
  throw new Error(msg)
}

export const bboxLonMin = convertAndAssertFloat(
  process.env.VUE_APP_BBOX_LON_MIN || 105,
)

export const bboxLonMax = convertAndAssertFloat(
  process.env.VUE_APP_BBOX_LON_MAX || 168,
)

if (bboxLonMin >= bboxLonMax) {
  const msg =
    `Config problem: bboxLonMin=${bboxLonMin} is NOT less than ` +
    `bboxLonMax=${bboxLonMax}`
  throw new Error(msg)
}

export const obsFieldSeparatorChar = process.env.VUE_APP_OBS_FIELD_SEP || '|'

export const appVersion = process.env.VUE_APP_VERSION || 'live.dev'

export const publicJwk = process.env.VUE_APP_PUBLIC_JWK

// More "constant" constants from here on

export const facadeSendObsUrlPrefix = `${facadeUrlBase}/observations`

export const pendingTasksKey = 'wow-pending-tasks' // for localStorage
export const apiTokenKey = 'api-token' // for localStorage

export const workerMessages = {
  facadeDeleteSuccess: 'facade-delete-success',
  facadeUpdateSuccess: 'facade-update-success',
  onLocalRecordTransition: 'local-record-transition',
}

export const noImagePlaceholderUrl = '/img/no-image-placeholder.png'
export const noPreviewAvailableUrl = '/img/no-preview-available.png'

export const noProfilePicPlaceholderUrl =
  '/img/no-profile-pic-placeholder-3.png'

export const onboarderComponentName = 'Onboarder'
export const onboarderPath = '/onboarder'

export const oauthCallbackComponentName = 'OauthCallback'

export const alwaysUpload = 'ALWAYS'
export const neverUpload = 'NEVER'

export const persistedStateLocalStorageKey = 'wow-vuex'

export const lfWowObsStoreName = 'wow-obs' // observations
export const lfWowPhotoStoreName = 'wow-photo' // photos
export const lfWowMetaStoreName = 'wow-meta' // things about the app

export const gh69MigrationKey = 'gh69-migration'
export const noOutcomeLastUpdatedMigrationKey =
  'no-outcome-last-updated-migration'
export const remoteObsKey = 'remote-obs'

export const recordProcessingOutcomeFieldName = 'recordProcessingOutcome'

export const notSupported = 'NOT_SUPPORTED'
export const blocked = 'BLOCKED'
export const failed = 'FAILED'

export const autocompleteTypeHost = 'host'
export const autocompleteTypeOrchid = 'orchid'

export const obsFieldName = 'obs'
export const recordTypeFieldName = 'recordType'
export const photosFieldName = 'photos'
export const photoIdsToDeleteFieldName = 'photos-delete'
export const photosToAddFieldName = 'photos-add'
export const obsFieldIdsToDeleteFieldName = 'obsFields-delete'
export const projectIdFieldName = 'projectId'
export const isEventuallyDeletedFieldName = 'isEventuallyDeleted'
export const wowUpdatedAtFieldName = 'wowUpdatedAt'
export const outcomeLastUpdatedAtFieldName = 'outcomeLastUpdatedAt'
export const versionFieldName = 'version'

export const syncSwWowQueueMsg = 'SYNC_SW_WOW_QUEUE'
export const skipWaitingMsg = 'SKIP_WAITING'
export const proxySwConsoleMsg = 'PROXY_SW_CONSOLE'
export const testTriggerManualCaughtErrorMsg = 'TEST_SW_MANUAL_CAUGHT_ERROR'
export const testTriggerManualUncaughtErrorMsg = 'TEST_SW_MANUAL_UNCAUGHT_ERROR'

// Record processing outcomes
export const draftOutcome = 'draft' // incomplete observation
export const waitingOutcome = 'waiting' // waiting to be processed
// left the value of this the same after the rename, so we don't have to migrate data
export const beingProcessedOutcome = 'withLocalProcessor' // we're actively processing it
export const successOutcome = 'success' // successfully processed
export const systemErrorOutcome = 'systemError' // processed but encountered an error

// FIXME do we need any of this service worker magic any more?
// FIXME this URL fails CORS in Firefox, can we use something else? If we still
// need it. registerRoute can use a matchCallback so we could hook on a custom
// header. Or make the SW respond to CORS. Need to make sure the requests don't
// go somewhere else if there's no SW
const serviceWorkerMagicUrlPrefix = 'https://local.service-worker'
export const serviceWorkerIsAliveMagicUrl = `${serviceWorkerMagicUrlPrefix}/are-you-alive`
export const serviceWorkerUpdateErrorTrackerContextUrl = `${serviceWorkerMagicUrlPrefix}/update-error-tracker-context`
export const serviceWorkerPlatformTestUrl = `${serviceWorkerMagicUrlPrefix}/platorm-test`

export const wowUuidCustomHttpHeader = 'x-wow-uuid'

export const isRemotePhotoFieldName = 'isRemote'

export const photoTypeWholePlant = 'whole-plant'
export const photoTypeFlower = 'flower'
export const photoTypeLeaf = 'leaf'
export const photoTypeFruit = 'fruit'
export const photoTypeHabitat = 'habitat'
export const photoTypeMicrohabitat = 'micro-habitat'
export const photoTypeCanopy = 'canopy'
export const photoTypeFloralVisitors = 'floral-visitors'
export const photoTypeEpiphyteHostTree = 'host-tree'

// gives the UI a cheap way to tell if the record is pre-migration
export const currentRecordVersion = 2

export const cryptoConfig = (() => {
  const algorithm = 'RSA-OAEP'
  const result = {
    algorithm,
    rsaParams: {
      name: algorithm,
      hash: 'SHA-256',
    },
  }
  return result
})()

function convertAndAssertInteger(val) {
  const isNotInteger = !/^-?\d+$/.test(val)
  if (isNotInteger) {
    throw new Error(
      `Runtime config problem: expected integer is not valid='${val}'`,
    )
  }
  return parseInt(val, 10)
}

function convertAndAssertFloat(val) {
  const isNotFloat = !/^-?\d+(\.\d+)?$/.test(val)
  if (isNotFloat) {
    throw new Error(
      `Runtime config problem: expected float is not valid='${val}'`,
    )
  }
  return parseFloat(val)
}

function parseBoolean(val) {
  // slightly better than "any string is truthy"
  if (val === 'true' || val === 1) {
    return true
  }
  if (val === 'false' || val === 0) {
    return false
  }
  return !!(val || false)
}

export const _testonly = {
  convertAndAssertFloat,
  convertAndAssertInteger,
  parseBoolean,
}
