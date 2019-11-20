import localForage from 'localforage'

const knownInstances = {}

export function getOrCreateInstance(name) {
  const existingInstance = knownInstances[name]
  if (existingInstance) {
    return existingInstance
  }
  const instance = localForage.createInstance({
    name: name,
  })
  knownInstances[name] = instance
  return instance
}

export async function deleteKnownStorageInstances() {
  // FIXME expand to try to delete *all* DBs we can find. We can copy how Dexie
  // does it
  // https://github.com/dfahlander/Dexie.js/blob/fb735811fd72829a44c86f82b332bf6d03c21636/src/helpers/database-enumerator.ts#L18.
  // This will work on Chrome and WebKit but Firefox doesn't allow enumerating
  // DBs (yet).
  const promises = Object.keys(knownInstances).map(e => {
    return e.dropInstance()
  })
  return Promise.all(promises)
}
