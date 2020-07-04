// needs to be the module.exports style so node can use it when
// running the scripts/create-obs-fields.js script.
module.exports = {
  obsFieldNamePrefix: process.env.VUE_APP_OBS_FIELD_PREFIX || 'WOW ',
  notCollected: 'Not collected',

  multiselectSeparator: ' - ',

  exact: 'Exact',

  epiphyte: 'Epiphyte',
  terrestrial: 'Terrestrial',

  yesValue: 'Yes',
  noValue: 'No',

  precise: 'Precise',
  estimated: 'Estimated',

  conservationLanduse: 'Conservation and natural environments',
}
