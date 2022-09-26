import localForage from 'localforage'
import { ChainedError } from '@/misc/only-common-deps-helpers'

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
    name,
  }
  if (lfDriver) {
    lfConfig.driver = lfDriver
  }
  const instance = localForage.createInstance(lfConfig)
  knownInstances[name] = instance
  return instance
}

export function deleteKnownStorageInstances() {
  // FIXME expand to try to delete *all* DBs we can find. We can copy how Dexie
  // does it
  // https://github.com/dfahlander/Dexie.js/blob/fb735811fd72829a44c86f82b332bf6d03c21636/src/helpers/database-enumerator.ts#L18.
  // This will work on Chrome and WebKit but Firefox doesn't allow enumerating
  // DBs (yet).
  const promises = Object.keys(knownInstances).map(dropInstanceByName)
  return Promise.all(promises)
}

async function dropInstanceByName(name) {
  const instance = knownInstances[name]
  await instance.clear()
  console.debug(`Dropping store '${name}'...`)
  // purposesly not 'await'-ing the dropInstance call. It's not all that
  // reliable in that it queues our call rather than forcing it happen
  // instantly. So, seeing as we have a user waiting at the other end, let's
  // just be happy that we've already cleared the instance and if it manages to
  // get dropped before we refresh the page, that's a bonus.
  instance
    .dropInstance()
    .then(() => {
      console.debug(`Successfully dropped store '${name}'`)
    })
    .catch((err) => {
      throw ChainedError(`Failed to delete store with name=${name}`, err)
    })
}

export const _testonly = {
  forceLocalForageDriver(driverName) {
    lfDriver = driverName
  },
}
