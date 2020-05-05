import { Queue } from 'workbox-background-sync/Queue'
import { _testonly as objectUnderTest } from '@/../sw-src/sw'
import { getRecord, storeRecord } from '@/../src/indexeddb/obs-store-common'
import { getOrCreateInstance } from '@/../src/indexeddb/storage-manager'
import * as constants from '@/../src/misc/constants'

const dontCallMe = () => {
  throw new Error('should not be called')
}

describe('serviceWorker', () => {
  let origNodeEnv
  let origConsoleDebug
  const wowStore = getOrCreateInstance(constants.lfWowObsStoreName)

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
    wowStore.clear()
    global.clients.clearMessages()
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

    it('should ignore and discard requests for the same obsId after a 500 status', async () => {
      const obsUuid = '1234A'
      await storeRecord({
        uuid: obsUuid,
        wowMeta: {
          [constants.recordProcessingOutcomeFieldName]:
            constants.withServiceWorkerOutcome,
        },
      })
      objectUnderTest.setAuthHeader('eySomeToken')
      const testQueue = new Queue('test-queue' + Math.random())
      for (const curr of '123') {
        await testQueue.pushRequest({
          request: new global.WowMockRequest(
            `/test/blah/part${curr}?testId=${curr}`,
          ),
          metadata: { obsId: 666, obsUuid },
        })
      }
      const fnUnderTest = objectUnderTest.onSyncWithPerItemCallback.bind(
        testQueue,
      )
      const testIdsFetched = []
      global.fetch = async req => {
        const testId = testIdFromUrl(req.url)
        testIdsFetched.push(testId)
        return {
          status: 500,
        }
      }
      await fnUnderTest(dontCallMe, dontCallMe)
      expect(testIdsFetched).toEqual([1])
      expect((await testQueue.getAll()).length).toEqual(0)
      const record = await getRecord(obsUuid)
      expect(
        record.wowMeta[constants.recordProcessingOutcomeFieldName],
      ).toEqual(constants.systemErrorOutcome)
    })

    it(
      'should handle a "failed to fetch" situation that has repeated more ' +
        'than the threshold by giving up and ignoring all reqs from the same ' +
        'obs, then processing remaining reqs',
      async () => {
        objectUnderTest.setAuthHeader('eySomeToken')
        const testQueue = new Queue('test-queue' + Math.random())
        const failingObsUuid = '123ABC' // ID of the obs that will fail
        await storeRecord({
          uuid: failingObsUuid,
          wowMeta: {
            [constants.recordProcessingOutcomeFieldName]:
              constants.withServiceWorkerOutcome,
          },
        })
        for (const curr of '123') {
          // create 3 reqs for the one obs
          await testQueue.pushRequest({
            request: new global.WowMockRequest(
              `/test/blah/part${curr}?testId=${curr}`,
            ),
            metadata: { obsId: 666, obsUuid: failingObsUuid },
          })
        }
        await testQueue.pushRequest({
          // req for a separate obs
          request: new global.WowMockRequest(`/test/other-obs?testId=4`),
          metadata: { obsId: 987, obsUuid: '919ZXX' },
        })
        const fnUnderTest = objectUnderTest.onSyncWithPerItemCallback.bind(
          testQueue,
        )
        const testIdsFetched = []
        global.fetch = async req => {
          const testId = testIdFromUrl(req.url)
          testIdsFetched.push(testId)
          if (testId === 1) {
            throw new Error('TESTTARGET Failed to fetch')
          }
          return {
            status: 200,
          }
        }
        let idSuppliedToClientSuccessCb
        let isSuccessCbCalled = false
        const oneMoreThanThreshold = constants.maxReqFailureCountInSw + 1
        for (let i = 1; i <= oneMoreThanThreshold; i++) {
          try {
            const origConsoleWarn = console.warn
            console.warn = () => {}
            await fnUnderTest(entry => {
              if (isSuccessCbCalled) {
                throw new Error('should only be called once!')
              }
              isSuccessCbCalled = true
              idSuppliedToClientSuccessCb = testIdFromUrl(entry.request.url)
            }, dontCallMe)
            console.warn = origConsoleWarn
          } catch (err) {
            const isExpectedError =
              err.name === 'QueueReplayError' &&
              err.message.indexOf('TESTTARGET Failed to fetch')
            if (!isExpectedError) {
              // only expected FailedToFetch
              throw err
            }
          }
        }
        expect(testIdsFetched).toEqual([
          ...'1'
            .repeat(oneMoreThanThreshold)
            .split('')
            .map(e => parseInt(e)),
          4,
        ])
        const queueItems = await testQueue.getAll()
        expect(queueItems.length).toEqual(0)
        expect(global.clients.messagesSentToClients).toEqual([
          { id: constants.refreshLocalQueueMsg },
        ])
        expect(idSuppliedToClientSuccessCb).toEqual(4)
        const record = await getRecord(failingObsUuid)
        expect(
          record.wowMeta[constants.recordProcessingOutcomeFieldName],
        ).toEqual(constants.systemErrorOutcome)
      },
    )
  })
})

function testIdFromUrl(url) {
  return parseInt(url.replace(/.*testId=/, ''))
}
