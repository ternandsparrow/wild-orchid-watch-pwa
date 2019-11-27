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
export const targetTaxaNodeId = parseInt(
  process.env.VUE_APP_TARGET_TAXA_ID || assumedIdOfLifeTaxa,
)

export const accuracyOfCountObsFieldId = parseInt(
  process.env.VUE_APP_OBS_FIELD_ID_ACCURACY,
)

// Needs to match the value that the obs field accepts
export const accuracyOfCountObsFieldDefault =
  process.env.VUE_APP_OBS_FIELD_DEFAULT_ACCURACY || 'Exact'

export const countOfIndividualsObsFieldId = parseInt(
  process.env.VUE_APP_OBS_FIELD_ID_COUNT,
)

export const countOfIndividualsObsFieldDefault = 1

export const orchidTypeObsFieldId = parseInt(
  process.env.VUE_APP_OBS_FIELD_ID_ORCHID_TYPE,
)

// The value that indicates we need to show/hide other fields conditional on this
export const orchidTypeEpiphyte =
  process.env.VUE_APP_OBS_FIELD_ORCHID_TYPE_EPIPHYTE || 'Epiphyte'

export const hostTreeSpeciesObsFieldId = parseInt(
  process.env.VUE_APP_OBS_FIELD_ID_HOST_TREE,
)

export const epiphyteHeightObsFieldId = parseInt(
  process.env.VUE_APP_OBS_FIELD_ID_EPIPHYTE_HEIGHT,
)

export const approxAreaSearchedObsFieldId = parseInt(
  process.env.VUE_APP_OBS_FIELD_AREA_SEARCHED,
)

export const obsFieldSeparatorChar = process.env.VUE_APP_OBS_FIELD_SEP || '|'

export const obsFieldPrefix = process.env.VUE_APP_OBS_FIELD_PREFIX || 'WOW '

export const appVersion = process.env.VUE_APP_VERSION || 'live.dev'

// More "constant" constants from here on

export const noImagePlaceholderUrl = '/img/no-image-placeholder.png'

export const noProfilePicPlaceholderUrl = 'img/no-profile-pic-placeholder-3.png'

export const onboarderComponentName = 'Onboarder'

export const oauthCallbackComponentName = 'OauthCallback'

export const alwaysUpload = 'ALWAYS'

export const neverUpload = 'NEVER'

export const persistedStateLocalStorageKey = 'wow-vuex'

export const recordProcessingOutcomeFieldName = 'recordProcessingOutcome'

export const beginner = 'BEGINNER'
export const expert = 'EXPERT'

export const notSupported = 'NOT_SUPPORTED'
export const blocked = 'BLOCKED'
export const failed = 'FAILED'

export const obsFieldName = 'obs'
export const photosFieldName = 'photos'
export const photoIdsToDeleteFieldName = 'photos-delete'
export const obsFieldsFieldName = 'obsFields'
export const obsFieldIdsToDeleteFieldName = 'obsFields-delete'
export const projectIdFieldName = 'projectId'

export const syncDepsQueueMsg = 'SYNC_DEPS_QUEUE'
export const syncObsQueueMsg = 'SYNC_OBS_QUEUE'
export const refreshObsMsg = 'REFRESH_OBS'
export const obsPutSuccessMsg = 'OBS_PUT_SUCCESS'
export const failedToUploadObsMsg = 'OBS_CREATE_FAIL'
export const failedToEditObsMsg = 'OBS_EDIT_FAIL'
export const skipWaitingMsg = 'SKIP_WAITING'

const serviceWorkerMagicUrlPrefix = 'http://local.service-worker'
export const serviceWorkerBundleMagicUrl =
  serviceWorkerMagicUrlPrefix + '/queue/obs-bundle'
export const serviceWorkerIsAliveMagicUrl =
  serviceWorkerMagicUrlPrefix + '/are-you-alive'
export const serviceWorkerUpdateAuthHeaderUrl =
  serviceWorkerMagicUrlPrefix + '/update-auth-header'
