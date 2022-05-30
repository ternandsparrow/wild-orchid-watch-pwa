import dayjs from 'dayjs'
import localForage from 'localforage'
import { _testonly } from '@/indexeddb/storage-manager'
import { _testonly as workerMgrTestOnly } from '@/misc/web-worker-manager'

expect.extend({
  toBeValidDateString(received) {
    const isValid = dayjs(received).isValid()
    return {
      pass: isValid,
      // according to the doco
      // (https://jestjs.io/docs/en/expect#expectextendmatchers), we're meant to
      // have two versions of the message, but I don't. Hope that doesn't upset
      // you.
      message: () => `expected '${received}' to be a valid date string`,
    }
  },
})

expect.extend({
  toBeUuidString(received) {
    return {
      pass: expect.stringMatching(/^.{36}$/).asymmetricMatch(received),
      message: () => `expected '${received}' to be a UUID string`,
    }
  },
})

// Enjoy this glorious piece of hackery! JS modules are singletons so we can
// modify them and it will affect all others that use them too. Comlink has
// dependencies that make it hard to run in Node so we just replace the
// function that uses Comlink completely in tests.
workerMgrTestOnly.interceptableFns.buildWorker = function () {
  return require('@/misc/web.worker')._testonly.exposed
}

// we load "fake-indexeddb/auto" in the test setupFiles, but just to make sure
// we'll force localForage to use the fake IndexedDB.
_testonly.forceLocalForageDriver(localForage.INDEXEDDB)

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
    this.store[key] = value // localForage will handle serialisation
  }

  removeItem(key) {
    delete this.store[key]
  }
}

global.localStorage = new LocalStorageMock()

// various stubs
global.Worker = function () {}
global.URL = (function () {
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
  self.matchAll = function () {
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
  self.clearMessages = function () {
    self.messagesSentToClients = []
  }
})()
