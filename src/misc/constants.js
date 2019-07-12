// We *must* use VUE_APP_ as a prefix on the env vars, see for more details:
// https://cli.vuejs.org/guide/mode-and-env.html#using-env-variables-in-client-side-code

export const apiUrlBase = process.env.VUE_APP_API_BASE_URL

export const inatUrlBase = process.env.VUE_APP_INAT_BASE_URL

export const inatStaticUrlBase = process.env.VUE_APP_INAT_STATIC_BASE_URL

export const appId = process.env.VUE_APP_OAUTH_APP_ID

export const redirectUri = process.env.VUE_APP_OAUTH_REDIRECT_URI

export const inatProjectSlug = process.env.VUE_APP_INAT_PROJECT_SLUG

export const isDeployedToProd = (() => {
  return process.env.VUE_APP_DEPLOYED_ENV_IS_PROD === 'true'
})()

export const obsFieldSeparatorChar = process.env.VUE_APP_OBS_FIELD_SEP || '|'

export const obsFieldPrefix = process.env.VUE_APP_OBS_FIELD_PREFIX || 'WOW '

export const appVersion = process.env.VUE_APP_VERSION || 'live.dev'

export const noImagePlaceholderUrl = 'img/no-image-placeholder.png'

export const noProfilePicPlaceholderUrl = 'img/no-profile-pic-placeholder.png'
