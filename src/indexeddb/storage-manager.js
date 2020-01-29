import localForage from 'localforage'

const knownInstances = {}
const useDefaultLocalForageLogic = undefined
let lfDriver = useDefaultLocalForageLogic

export function getOrCreateInstance(name) {
  const existingInstance = knownInstances[name]
  if (existingInstance) {
    return existingInstance
  }
  const lfConfig = {
    name: name,
  }
  if (lfDriver) {
    lfConfig.driver = lfDriver
  }
  const instance = localForage.createInstance(lfConfig)
  knownInstances[name] = instance
  return instance
}

export async function deleteKnownStorageInstances() {
  // FIXME expand to try to delete *all* DBs we can find. We can copy how Dexie
  // does it
  // https://github.com/dfahlander/Dexie.js/blob/fb735811fd72829a44c86f82b332bf6d03c21636/src/helpers/database-enumerator.ts#L18.
  // This will work on Chrome and WebKit but Firefox doesn't allow enumerating
  // DBs (yet).
  const promises = Object.keys(knownInstances).map(k => {
    const instance = knownInstances[k]
    console.debug(`Dropping store '${k}'`)
    return instance.dropInstance()
  })
  return Promise.all(promises)
}

export const _testonly = {
  forceLocalForageDriver(driverName) {
    lfDriver = driverName
  },
}