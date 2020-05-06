import localForage from 'localforage'
import { _testonly } from '@/indexeddb/storage-manager'
import { _testonly as obsStoreTestOnly } from '@/store/obs'
import { _testonly as ephemeralStoreTestOnly } from '@/store/ephemeral'

// Enjoy this glorious piece of hackery! JS modules are singletons so we can
// modify them and it will affect all others that use them too. Comlink has
// dependencies that make it hard to run in Node so we just replace the
// function that uses Comlink completely in tests.
obsStoreTestOnly.interceptableFns.buildWorker = function() {
  return require('@/store/map-over-obs-store.worker.js')._testonly
}
ephemeralStoreTestOnly.interceptableFns.buildWorker = function() {
  return require('@/store/image-compression.worker.js')._testonly
}

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
global.WowMockRequest = function MockRequest(url) {
  const self = this
  self.method = 'GET'
  self.clone = () => ({
    method: self.method,
    headers: { entries: () => [], set: () => {} },
    url,
  })
  self.url = url
}
global.Request = global.WowMockRequest
global.registration = {
  scope: 'testing',
  sync: { register() {} },
}
global.__WB_MANIFEST = []

global.MessageChannel = function MockMessageChannel() {
  this.port1 = {
    onmessage() {
      throw new Error('Programmer error: implement me!')
    },
  }
  this.port2 = {
    port1: this.port1,
  }
}
global.clients = new (function MockClients() {
  const self = this
  self.messagesSentToClients = []
  self.matchAll = function() {
    const aClient = {
      postMessage(msg, channels) {
        self.messagesSentToClients.push(msg)
        for (const curr of channels) {
          curr.port1.onmessage({ data: 'thanks' })
        }
      },
    }
    return [aClient]
  }
  self.clearMessages = function() {
    self.messagesSentToClients = []
  }
})()
