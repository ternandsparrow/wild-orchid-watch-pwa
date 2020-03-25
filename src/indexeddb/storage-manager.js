import localForage from 'localforage'

const knownInstances = {}
// we don't support localStorage because need to store binary data. We could
// achieve that but we'd have to do our own serialisation.
let lfDriver = [localForage.INDEXEDDB, localForage.WEBSQL]

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
  instance.ready().catch(err => {
    console.error('Failed to initialise LocalForage', err)
    alert(
      // TODO might be nicer to use an Onsen notification but they're hard to access from here
      'Failed to set up local database. This app will not work properly. ' +
        'To fix this, make sure your browser is up to date. ' +
        'Private/Incognito mode in some browsers will also cause this.',
    )
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
