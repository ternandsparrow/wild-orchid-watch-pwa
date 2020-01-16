import { Queue } from 'workbox-background-sync/Queue'
import { _testonly as objectUnderTest } from '@/../sw-src/sw'

const dontCallMe = () => {
  throw new Error('should not be called')
}

describe('serviceWorker', () => {
  let origNodeEnv
  let origConsoleDebug

  beforeAll(function() {
    origNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production' // stops workbox logging
    origConsoleDebug = console.debug
    console.debug = () => {}
  })

  afterAll(function() {
    process.env.NODE_ENV = origNodeEnv
    console.debug = origConsoleDebug
  })

  beforeEach(function() {
    objectUnderTest.setAuthHeader(null)
    global.fetch = undefined
  })

  describe('isSafeToProcessQueue', () => {
    it('should be false when no auth header is set', async () => {
      objectUnderTest.setAuthHeader(null)
      const result = objectUnderTest.isSafeToProcessQueue()
      expect(result).toEqual(false)
    })

    it('should be true when auth header IS set', async () => {
      objectUnderTest.setAuthHeader('eySomeToken')
      const result = objectUnderTest.isSafeToProcessQueue()
      expect(result).toEqual(true)
    })
  })

  describe('onSyncWithPerItemCallback', () => {
    it('should handle an empty queue', async () => {
      objectUnderTest.setAuthHeader('eySomeToken')
      const testQueue = new Queue('test-queue' + Math.random())
      const fnUnderTest = objectUnderTest.onSyncWithPerItemCallback.bind(
        testQueue,
      )
      await fnUnderTest(dontCallMe, dontCallMe)
    })

    it('should call the successCb after a successful item', async () => {
      objectUnderTest.setAuthHeader('eySomeToken')
      const testQueue = new Queue('test-queue' + Math.random())
      await testQueue.unshiftRequest({
        request: new global.WowMockRequest('/test/blah'),
        metadata: { obsId: 666, obsUuid: '1234A' },
      })
      const fnUnderTest = objectUnderTest.onSyncWithPerItemCallback.bind(
        testQueue,
      )
      global.fetch = async () => ({
        status: 200,
      })
      let isSuccessCbCalled = false
      await fnUnderTest(() => {
        isSuccessCbCalled = true
      }, dontCallMe)
      expect(isSuccessCbCalled).toEqual(true)
    })

    it('should call the clientErrorCb after a 4xx status', async () => {
      objectUnderTest.setAuthHeader('eySomeToken')
      const testQueue = new Queue('test-queue' + Math.random())
      await testQueue.unshiftRequest({
        request: new global.WowMockRequest('/test/blah'),
        metadata: { obsId: 666, obsUuid: '1234A' },
      })
      const fnUnderTest = objectUnderTest.onSyncWithPerItemCallback.bind(
        testQueue,
      )
      global.fetch = async () => ({
        status: 404,
      })
      let isClientErrorCbCalled = false
      await fnUnderTest(dontCallMe, () => {
        isClientErrorCbCalled = true
      })
      expect(isClientErrorCbCalled).toEqual(true)
    })
  })
})
