// common functions for (de)serialising our taxon index
const minifiedNameMapping = {
  // id: 'i',
  preferredCommonName: 'p',
  name: 'n',
  // observationCount: 'c',
  // rank: 'r',
  photoUrl: 'u',
}

function serialise(obj) {
  // I tried msgpack-lite and it was only about 10% smaller than this approach
  const result = {}
  for (const [key, minifiedKey] of Object.entries(minifiedNameMapping)) {
    result[minifiedKey] = obj[key]
  }
  return result
}

function deserialise(obj) {
  const result = {}
  for (const [key, minifiedKey] of Object.entries(minifiedNameMapping)) {
    result[key] = obj[minifiedKey]
  }
  return result
}

module.exports = {
  serialise,
  deserialise,
}
