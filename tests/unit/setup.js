import localForage from 'localforage'
import { _testonly } from '@/indexeddb/storage-manager'

// we stub indexedDB below, which is required for workbox, but we don't want
// localForage to try to use it because it's just a stub
_testonly.forceLocalForageDriver(localForage.LOCALSTORAGE)

class LocalStorageMock {
  constructor() {
    this.store = {}
  }

  clear() {
    this.store = {}
  }

  getItem(key) {
    return this.store[key] || null
  }

  setItem(key, value) {
    this.store[key] = value.toString()
  }

  removeItem(key) {
    delete this.store[key]
  }
}

global.localStorage = new LocalStorageMock()

// stubs so browser-image-compression and workbox don't complain
global.Worker = function() {}
global.URL = (function() {
  const result = URL
  result.createObjectURL = () => {}
  return result
})()
global.IDBObjectStore = { prototype: {} }
global.IDBKeyRange = { only: () => {} }
global.indexedDB = { open: () => ({}) }
global.registration = {
  scope: 'testing',
  sync: 'something so the workbox Queue does NOT fire on startup',
}
