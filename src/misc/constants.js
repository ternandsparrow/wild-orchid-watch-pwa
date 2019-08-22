// We *must* use VUE_APP_ as a prefix on the env vars, see for more details:
// https://cli.vuejs.org/guide/mode-and-env.html#using-env-variables-in-client-side-code

// If you need a way to update config *faster* than these value, have a look at
// reviving the code in commit b5e6cec5dae0e08cbc990442d4303a9bae940914. It
// pulls config from the server rather than relying on the user updating the
// app shell to see the new values.

export const apiUrlBase = process.env.VUE_APP_API_BASE_URL

export const inatUrlBase = process.env.VUE_APP_INAT_BASE_URL

export const appTitle = process.env.VUE_APP_TITLE

export const inatStaticUrlBase = process.env.VUE_APP_INAT_STATIC_BASE_URL

export const appId = process.env.VUE_APP_OAUTH_APP_ID

export const redirectUri = process.env.VUE_APP_OAUTH_REDIRECT_URI

export const inatProjectSlug = process.env.VUE_APP_INAT_PROJECT_SLUG

export const isDeployedToProd = (() => {
  return process.env.VUE_APP_DEPLOYED_ENV_IS_PROD === 'true'
})()

export const googleMapsApiKey = process.env.VUE_APP_GMAPS_API_KEY

export const sentryDsn = process.env.VUE_APP_SENTRY_DSN

const assumedIdOfLifeTaxa = 1 // everything should have "Life" as an ancestor
// iNaturalist deals with much more taxa than what we're interested in. We only
// want orchids so we specify an integer ID (the ID in
// inaturalist.org/taxa/<ID>) here and we'll use it to filter species lists
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

// Needs to match the value that the obs field accepts
export const orchidTypeObsFieldDefault =
  process.env.VUE_APP_OBS_FIELD_DEFAULT_ORCHID_TYPE || 'Terrestrial'

// The value that indicates we need to show/hide other fields conditional on this
export const orchidTypeEpiphyte =
  process.env.VUE_APP_OBS_FIELD_ORCHID_TYPE_EPIPHYTE || 'Epiphyte'

export const hostTreeSpeciesObsFieldId = parseInt(
  process.env.VUE_APP_OBS_FIELD_ID_HOST_TREE,
)

export const epiphyteHeightObsFieldId = parseInt(
  process.env.VUE_APP_OBS_FIELD_ID_EPIPHYTE_HEIGHT,
)

export const obsFieldSeparatorChar = process.env.VUE_APP_OBS_FIELD_SEP || '|'

export const obsFieldPrefix = process.env.VUE_APP_OBS_FIELD_PREFIX || 'WOW '

export const appVersion = process.env.VUE_APP_VERSION || 'live.dev'

// More "constant" constants from here on

export const noImagePlaceholderUrl = '/img/no-image-placeholder.png'

export const noProfilePicPlaceholderUrl = 'img/no-profile-pic-placeholder.png'

export const onboarderComponentName = 'Onboarder'

export const oauthCallbackComponentName = 'OauthCallback'

export const alwaysUpload = 'ALWAYS'

export const neverUpload = 'NEVER'

export const persistedStateLocalStorageKey = 'wow-vuex'

export const successfullyProcessedAtFieldName = 'successfullyProcessedAt'
