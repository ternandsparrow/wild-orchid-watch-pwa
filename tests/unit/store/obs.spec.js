import { getOrCreateInstance } from '@/indexeddb/storage-manager'
import * as cc from '@/misc/constants'
import objectUnderTest, { _testonly, extractGeolocationText } from '@/store/obs'
import { _testonly as workerTestOnly } from '@/store/obs-store.worker'
import { _testonly as obsStoreCommonTestOnly } from '@/indexeddb/obs-store-common'

_testonly.interceptableFns.buildWorker = function() {
  return workerTestOnly.exposed
}

const originalFn = obsStoreCommonTestOnly.interceptableFns.storePhotoRecord
beforeAll(() => {
  // stub blob handling to avoid supplying full, valid Blobs for every test.
  obsStoreCommonTestOnly.interceptableFns.storePhotoRecord = (_, r) => ({
    ...r,
    thumb: true,
  })
})

afterAll(() => {
  obsStoreCommonTestOnly.interceptableFns.storePhotoRecord = originalFn
})

describe('mutations', () => {
  describe('addRecentlyUsedTaxa', () => {
    it('should create the type key when it does not already exist', () => {
      const state = {
        recentlyUsedTaxa: {},
      }
      objectUnderTest.mutations.addRecentlyUsedTaxa(state, {
        type: 'speciesGuess',
        value: { name: 'not important', preferredCommonName: 'species one' },
      })
      expect(state.recentlyUsedTaxa.speciesGuess).toHaveLength(1)
      expect(
        state.recentlyUsedTaxa.speciesGuess[0].preferredCommonName,
      ).toEqual('species one')
    })

    it('should add to the top of the stack when it already exists', () => {
      const state = {
        recentlyUsedTaxa: {
          speciesGuess: ['species existing'],
        },
      }
      objectUnderTest.mutations.addRecentlyUsedTaxa(state, {
        type: 'speciesGuess',
        value: { name: 'not important', preferredCommonName: 'species new' },
      })
      expect(state.recentlyUsedTaxa.speciesGuess).toHaveLength(2)
      expect(
        state.recentlyUsedTaxa.speciesGuess[0].preferredCommonName,
      ).toEqual('species new')
    })

    it('should move an entry to the top of the stack when it already exists', () => {
      const state = {
        recentlyUsedTaxa: {
          speciesGuess: [
            { name: 'not important', preferredCommonName: 'aaa' },
            { name: 'not important', preferredCommonName: 'bbb' },
            { name: 'not important', preferredCommonName: 'ccc' },
          ],
        },
      }
      objectUnderTest.mutations.addRecentlyUsedTaxa(state, {
        type: 'speciesGuess',
        value: { name: 'not important', preferredCommonName: 'ccc' },
      })
      expect(state.recentlyUsedTaxa.speciesGuess).toHaveLength(3)
      expect(
        state.recentlyUsedTaxa.speciesGuess.map(e => e.preferredCommonName),
      ).toEqual(['ccc', 'aaa', 'bbb'])
    })

    it('should ignore an empty value', () => {
      const state = {
        recentlyUsedTaxa: {
          speciesGuess: [
            { name: 'not important', preferredCommonName: 'aaa' },
            { name: 'not important', preferredCommonName: 'bbb' },
            { name: 'not important', preferredCommonName: 'ccc' },
          ],
        },
      }
      objectUnderTest.mutations.addRecentlyUsedTaxa(state, {
        type: 'speciesGuess',
        value: null,
      })
      expect(state.recentlyUsedTaxa.speciesGuess).toHaveLength(3)
      expect(
        state.recentlyUsedTaxa.speciesGuess.map(e => e.preferredCommonName),
      ).toEqual(['aaa', 'bbb', 'ccc'])
    })

    it('should maintain a stack of a maximum size', () => {
      const state = {
        recentlyUsedTaxa: {
          speciesGuess: [
            '1',
            '2',
            '3',
            '4',
            '5',
            '6',
            '7',
            '8',
            '9',
            '10',
            '11',
            '12',
            '13',
            '14',
            '15',
            '16',
            '17',
            '18',
            '19',
            '20',
          ].map(e => ({ name: e, preferredCommonName: e })),
        },
      }
      objectUnderTest.mutations.addRecentlyUsedTaxa(state, {
        type: 'speciesGuess',
        value: { name: 'not important', preferredCommonName: 'bump' },
      })
      expect(state.recentlyUsedTaxa.speciesGuess).toHaveLength(20)
      expect(
        state.recentlyUsedTaxa.speciesGuess[0].preferredCommonName,
      ).toEqual('bump')
      expect(state.recentlyUsedTaxa.speciesGuess[19].name).toEqual('19')
    })
  })
})

describe('actions', () => {
  let origConsoleDebug

  beforeAll(function() {
    origConsoleDebug = console.debug
    console.debug = () => {}
  })

  afterAll(function() {
    console.debug = origConsoleDebug
  })

  describe('waitForProjectInfo', () => {
    it('should succeed when we have projectInfo that is NOT stale', async () => {
      const state = { projectInfo: { id: 1 } }
      const rootState = {
        ephemeral: {
          networkOnLine: true,
        },
      }
      const getters = {
        isProjectInfoStale: false,
      }
      const dispatch = () => {
        fail('should not call')
      }
      await objectUnderTest.actions.waitForProjectInfo({
        state,
        dispatch,
        rootState,
        getters,
      })
    })

    it('should succeed when we have projectInfo that IS stale but we are offline', async () => {
      const state = { projectInfo: { id: 1 } }
      const rootState = {
        ephemeral: {
          networkOnLine: false,
        },
      }
      const getters = {
        isProjectInfoStale: true,
      }
      const dispatch = () => {
        fail('should not call')
      }
      await objectUnderTest.actions.waitForProjectInfo({
        state,
        dispatch,
        rootState,
        getters,
      })
    })

    it('should trigger refresh when we have projectInfo that IS stale but we are online', async () => {
      const state = { projectInfo: { id: 1 } }
      const rootState = {
        ephemeral: {
          networkOnLine: true,
        },
      }
      const getters = {
        isProjectInfoStale: true,
      }
      let isDispatchCalled = false
      const dispatch = () => {
        isDispatchCalled = true
      }
      await objectUnderTest.actions.waitForProjectInfo({
        state,
        dispatch,
        rootState,
        getters,
      })
      expect(isDispatchCalled).toBeTruthy()
    })

    it('should trigger refresh when we have NO projectInfo and are online', async () => {
      const state = {}
      const rootState = {
        ephemeral: {
          networkOnLine: true,
        },
      }
      const getters = {
        isProjectInfoStale: false,
      }
      let isDispatchCalled = false
      const dispatch = () => {
        isDispatchCalled = true
      }
      await objectUnderTest.actions.waitForProjectInfo({
        state,
        dispatch,
        rootState,
        getters,
      })
      expect(isDispatchCalled).toBeTruthy()
    })

    it('should throw when we have no projectInfo and we are offline', async () => {
      const state = {}
      const rootState = {
        ephemeral: {
          networkOnLine: false,
        },
      }
      const getters = {
        isProjectInfoStale: false,
      }
      const dispatch = () => {
        fail('should not call')
      }
      try {
        await objectUnderTest.actions.waitForProjectInfo({
          state,
          dispatch,
          rootState,
          getters,
        })
        fail('should have thrown')
      } catch (err) {
        // success
      }
    })
  })

  describe('buildObsFieldSorter', () => {
    it('should handle an empty list of fields', async () => {
      const obsFieldsToSort = []
      const getters = {
        obsFieldPositions: {},
      }
      const sorterFn = objectUnderTest.actions._buildObsFieldSorterWorkhorse({
        getters,
      })
      const result = sorterFn(obsFieldsToSort, 'id')
      expect(result).toHaveLength(0)
    })

    it('should throw when we do not provide a target field', async () => {
      const obsFieldsToSort = []
      const getters = {
        obsFieldPositions: {},
      }
      const sorterFn = objectUnderTest.actions._buildObsFieldSorterWorkhorse({
        getters,
      })
      try {
        sorterFn(obsFieldsToSort /* no targetField */)
        fail('Should throw due to no targetField')
      } catch (err) {
        // success
      }
    })

    it('should throw when we do not provide an array of fields to sort', async () => {
      const getters = {
        obsFieldPositions: {},
      }
      const sorterFn = objectUnderTest.actions._buildObsFieldSorterWorkhorse({
        getters,
      })
      try {
        sorterFn(/* no obsFieldsToSort */ 'id')
        fail('Should throw due to no obsFieldsToSort')
      } catch (err) {
        // success
      }
    })

    it('should sort an array objects with a field named "id"', async () => {
      const obsFieldsToSort = [
        { id: 333, name: 'prancer' },
        { id: 111, name: 'dasher' },
        { id: 555, name: 'blitzen' },
        { id: 999, name: 'comet' },
      ]
      const getters = {
        obsFieldPositions: {
          111: 0,
          333: 1,
          555: 2,
          999: 3,
        },
      }
      const sorterFn = objectUnderTest.actions._buildObsFieldSorterWorkhorse({
        getters,
      })
      const result = sorterFn(obsFieldsToSort, 'id')
      // a hacky "ordered array matcher"
      expect(JSON.stringify(result.map(e => e.name))).toEqual(
        JSON.stringify(['dasher', 'prancer', 'blitzen', 'comet']),
      )
    })

    it('should throw when not all fields have the targetField', async () => {
      const obsFieldsToSort = [
        { fieldId: 333, name: 'prancer' },
        { fieldId: 111, name: 'dasher' },
        { /* missing fieldId*/ name: 'blitzen' },
      ]
      const getters = {
        obsFieldPositions: {
          111: 0,
          333: 1,
          555: 2,
        },
      }
      const sorterFn = objectUnderTest.actions._buildObsFieldSorterWorkhorse({
        getters,
      })
      try {
        sorterFn(obsFieldsToSort, 'fieldId')
        fail('should throw due to invalid obs field')
      } catch (err) {
        // success
      }
    })
  })

  describe('things that need a datastore', () => {
    const obsStore = getOrCreateInstance(cc.lfWowObsStoreName)

    beforeEach(async () => {
      await obsStore.clear()
    })

    afterAll(async () => {
      await obsStore.clear()
    })

    describe('edit strategies', () => {
      describe('cancelFailedDeletes', () => {
        it('should run without error when there is nothing to do', async () => {
          await objectUnderTest.actions.cancelFailedDeletes({
            getters: {
              deletesWithErrorDbIds: [],
            },
            dispatch: () => {},
          })
          // no errors is a success
        })

        it('should remove delete action records from the DB when required', async () => {
          await obsStore.setItem('123A', {
            uuid: '123A',
          })
          await objectUnderTest.actions.cancelFailedDeletes({
            getters: {
              deletesWithErrorDbIds: ['123A'],
            },
            dispatch: () => {},
          })
          const result = await obsStore.getItem('123A')
          expect(result).toBeNull()
        })
      })

      it('should reset localForage store for each test', async () => {
        // not completely foolproof but a canary to verify beforeEach
        const result = (await obsStore.keys()).length
        expect(result).toEqual(0)
      })
    })

    describe('cleanLocalRecord', () => {
      it(
        'should just delete the record from the store when no blocked action ' +
          'exists',
        async () => {
          const record = {
            uuid: '123A',
          }
          await obsStore.setItem('123A', record)
          await objectUnderTest.actions.cleanLocalRecord(
            { state: {} },
            { currDbId: '123A', idsWithBlockedActions: [] },
          )
          const result = await obsStore.getItem('123A')
          expect(result).toBeNull()
        },
      )

      it('should queue the blocked action when there is one', async () => {
        const record = {
          uuid: '123A',
          existingValue: 'banana',
          wowMeta: {
            [cc.blockedActionFieldName]: {
              wowMeta: {
                [cc.recordProcessingOutcomeFieldName]: 'test-outcome',
                allBlockedObjFields: 'yep',
              },
            },
          },
        }
        await obsStore.setItem('123A', record)
        await objectUnderTest.actions.cleanLocalRecord(
          {
            state: {
              allRemoteObs: [
                {
                  uuid: '123A',
                  inatId: 667,
                  someRemoteField: 'test',
                },
              ],
            },
          },
          { currDbId: '123A', idsWithBlockedActions: ['123A'] },
        )
        const result = await obsStore.getItem('123A')
        expect(result).toEqual({
          uuid: '123A',
          inatId: 667,
          existingValue: 'banana',
          wowMeta: {
            [cc.recordProcessingOutcomeFieldName]: 'test-outcome',
            allBlockedObjFields: 'yep',
            [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.versionFieldName]: cc.currentRecordVersion,
          },
        })
      })

      it('should throw the expected error when the remote record is missing', async () => {
        const record = {
          uuid: '123A',
        }
        await obsStore.setItem('123A', record)
        expect(
          objectUnderTest.actions.cleanLocalRecord(
            {
              state: {
                allRemoteObs: [
                  // no matching uuid
                ],
              },
            },
            { currDbId: '123A', idsWithBlockedActions: ['123A'] },
          ),
        ).rejects.toThrow(
          `Unable to find remote record with UUID='123A', cannot continue.`,
        )
      })
    })
  })

  describe('refreshLocalRecordQueue', () => {
    const obsStore = getOrCreateInstance(cc.lfWowObsStoreName)

    beforeEach(async () => {
      await obsStore.clear()
    })

    afterAll(async () => {
      await obsStore.clear()
    })

    it('should see a new record as UI visible', async () => {
      const record = {
        uuid: '123A',
        photos: [],
        wowMeta: {
          [cc.recordTypeFieldName]: 'new',
          [cc.recordProcessingOutcomeFieldName]: 'waiting',
          [cc.photosToAddFieldName]: [],
        },
      }
      await obsStore.setItem('123A', record)
      const committedState = {}
      await objectUnderTest.actions.refreshLocalRecordQueue({
        commit: (key, value) => (committedState[key] = value),
      })
      expect(committedState.setLocalQueueSummary).toEqual([
        {
          [cc.recordTypeFieldName]: 'new',
          [cc.isEventuallyDeletedFieldName]: false,
          [cc.recordProcessingOutcomeFieldName]: 'waiting',
          [cc.hasBlockedActionFieldName]: false,
          inatId: undefined,
          uuid: '123A',
        },
      ])
      expect(committedState.setUiVisibleLocalRecords).toEqual([
        {
          geolocationAccuracy: undefined,
          thumbnailUrl: null,
          uuid: '123A',
          wowMeta: {
            [cc.recordTypeFieldName]: 'new',
            [cc.recordProcessingOutcomeFieldName]: 'waiting',
            [cc.photosToAddFieldName]: [],
          },
        },
      ])
    })

    it('should see record with a blocked delete action as NOT UI visible', async () => {
      const record = {
        uuid: '123A',
        inatId: 33,
        photos: [],
        wowMeta: {
          [cc.recordTypeFieldName]: 'edit',
          [cc.recordProcessingOutcomeFieldName]: cc.beingProcessedOutcome,
          [cc.blockedActionFieldName]: {
            uuid: '123A',
            inatId: 33,
            photos: [],
            wowMeta: {
              [cc.recordTypeFieldName]: 'delete',
            },
          },
        },
      }
      await obsStore.setItem('123A', record)
      const committedState = {}
      await objectUnderTest.actions.refreshLocalRecordQueue({
        commit: (key, value) => (committedState[key] = value),
      })
      expect(committedState.setLocalQueueSummary).toEqual([
        {
          [cc.recordTypeFieldName]: 'edit',
          [cc.isEventuallyDeletedFieldName]: true,
          [cc.recordProcessingOutcomeFieldName]: cc.beingProcessedOutcome,
          [cc.hasBlockedActionFieldName]: true,
          inatId: 33,
          uuid: '123A',
        },
      ])
      expect(committedState.setUiVisibleLocalRecords).toEqual([])
    })
  })

  describe('deleteSelectedRecord', () => {
    const obsStore = getOrCreateInstance(cc.lfWowObsStoreName)

    beforeEach(async () => {
      await obsStore.clear()
    })

    afterAll(async () => {
      await obsStore.clear()
    })

    it(
      'should directly delete a local-only record that has NOT ' +
        'started processing',
      async () => {
        await obsStore.setItem('123A', {
          uuid: '123A',
          photos: [],
          wowMeta: {
            [cc.recordProcessingOutcomeFieldName]: 'waiting',
            [cc.recordTypeFieldName]: 'new',
            [cc.photosToAddFieldName]: [],
          },
        })
        const state = {
          allRemoteObs: [],
        }
        const capturedCommits = {}
        await objectUnderTest.actions.deleteSelectedRecord(
          await buildAutoQueueRefreshContext(state, capturedCommits, '123A'),
        )
        const result = await obsStore.getItem('123A')
        expect(result).toBeNull()
        expect(capturedCommits.setSelectedObservationUuid).toBeNull()
      },
    )

    it(
      'should queue a blocked delete action for a local record ' +
        'that has started processing',
      async () => {
        await obsStore.setItem('123A', {
          uuid: '123A',
          photos: [],
          wowMeta: {
            [cc.recordTypeFieldName]: 'new',
            [cc.recordProcessingOutcomeFieldName]: cc.beingProcessedOutcome,
            [cc.photosToAddFieldName]: [],
          },
        })
        const state = {
          allRemoteObs: [],
        }
        const capturedCommits = {}
        await objectUnderTest.actions.deleteSelectedRecord(
          await buildAutoQueueRefreshContext(state, capturedCommits, '123A'),
        )
        const result = await obsStore.getItem('123A')
        expect(result.wowMeta[cc.blockedActionFieldName]).toEqual({
          wowMeta: {
            [cc.recordTypeFieldName]: 'delete',
            [cc.recordProcessingOutcomeFieldName]: 'waiting',
            [cc.photoIdsToDeleteFieldName]: [],
            [cc.photosToAddFieldName]: [],
            [cc.obsFieldIdsToDeleteFieldName]: [],
          },
        })
        expect(capturedCommits.setSelectedObservationUuid).toBeNull()
      },
    )

    it('should queue a delete action for the remote record', async () => {
      await obsStore.setItem('123A', {
        uuid: '123A',
        photos: [],
        wowMeta: {
          [cc.photosToAddFieldName]: [],
        },
      })
      const state = {
        allRemoteObs: [{ uuid: '123A', inatId: 666 }],
      }
      const capturedCommits = {}
      await objectUnderTest.actions.deleteSelectedRecord(
        await buildAutoQueueRefreshContext(state, capturedCommits, '123A'),
      )
      const result = await obsStore.getItem('123A')
      expect(result).toEqual({
        inatId: 666,
        uuid: '123A',
        wowMeta: {
          [cc.recordTypeFieldName]: 'delete',
          [cc.recordProcessingOutcomeFieldName]: 'waiting',
          [cc.photoIdsToDeleteFieldName]: [],
          [cc.photosToAddFieldName]: [],
          [cc.obsFieldIdsToDeleteFieldName]: [],
          [cc.versionFieldName]: cc.currentRecordVersion,
        },
      })
      expect(capturedCommits.setSelectedObservationUuid).toBeNull()
    })

    it(
      'should clobber the existing action for a remote record ' +
        'with local edit that is NOT processing',
      async () => {
        await obsStore.setItem('123A', {
          uuid: '123A',
          photos: [],
          wowMeta: {
            [cc.recordProcessingOutcomeFieldName]: 'waiting',
            [cc.recordTypeFieldName]: 'edit',
            [cc.photoIdsToDeleteFieldName]: ['this should get clobbered'],
            [cc.photosToAddFieldName]: [],
          },
        })
        const state = {
          allRemoteObs: [{ uuid: '123A', inatId: 666 }],
        }
        const capturedCommits = {}
        await objectUnderTest.actions.deleteSelectedRecord(
          await buildAutoQueueRefreshContext(state, capturedCommits, '123A'),
        )
        const result = await obsStore.getItem('123A')
        expect(result).toEqual({
          inatId: 666,
          uuid: '123A',
          wowMeta: {
            [cc.recordTypeFieldName]: 'delete',
            [cc.recordProcessingOutcomeFieldName]: 'waiting',
            [cc.photoIdsToDeleteFieldName]: [],
            [cc.photosToAddFieldName]: [],
            [cc.obsFieldIdsToDeleteFieldName]: [],
            [cc.versionFieldName]: cc.currentRecordVersion,
          },
        })
        expect(capturedCommits.setSelectedObservationUuid).toBeNull()
      },
    )

    it(
      'should queue a blocked delete action for a remote record ' +
        'with local edit that IS processing',
      async () => {
        await obsStore.setItem('123A', {
          uuid: '123A',
          inatId: 666,
          photos: [],
          wowMeta: {
            [cc.recordProcessingOutcomeFieldName]: cc.beingProcessedOutcome,
            [cc.recordTypeFieldName]: 'edit',
            [cc.photosToAddFieldName]: [],
          },
        })
        const state = {
          allRemoteObs: [{ uuid: '123A', inatId: 666 }],
        }
        const capturedCommits = {}
        await objectUnderTest.actions.deleteSelectedRecord(
          await buildAutoQueueRefreshContext(state, capturedCommits, '123A'),
        )
        const result = await obsStore.getItem('123A')
        expect(result.wowMeta[cc.recordTypeFieldName]).toEqual('edit')
        expect(result.wowMeta[cc.blockedActionFieldName]).toEqual({
          wowMeta: {
            [cc.recordTypeFieldName]: 'delete',
            [cc.recordProcessingOutcomeFieldName]: 'waiting',
            [cc.photoIdsToDeleteFieldName]: [],
            [cc.photosToAddFieldName]: [],
            [cc.obsFieldIdsToDeleteFieldName]: [],
          },
        })
        expect(capturedCommits.setSelectedObservationUuid).toBeNull()
      },
    )
  })

  describe('deleteSelectedLocalRecord', () => {
    const obsStore = getOrCreateInstance(cc.lfWowObsStoreName)

    beforeEach(async () => {
      await obsStore.clear()
    })

    afterAll(async () => {
      await obsStore.clear()
    })

    it('should delete a local record when it exists', async () => {
      await obsStore.setItem('123A', {
        uuid: '123A',
        wowMeta: {
          [cc.recordProcessingOutcomeFieldName]: 'waiting',
          [cc.recordTypeFieldName]: 'new',
          [cc.photosToAddFieldName]: [],
        },
      })
      const state = {
        allRemoteObs: [],
      }
      const capturedCommits = {}
      await objectUnderTest.actions.deleteSelectedLocalRecord(
        await buildAutoQueueRefreshContext(state, capturedCommits, '123A'),
      )
      const result = await obsStore.getItem('123A')
      expect(result).toBeNull()
      expect(capturedCommits.setSelectedObservationUuid).toBeNull()
    })

    it('should not throw an error when we try to delete a non-existent ID', async () => {
      // obsStore is empty
      const state = {
        allRemoteObs: [],
      }
      const capturedCommits = {}
      await objectUnderTest.actions.deleteSelectedLocalRecord(
        await buildAutoQueueRefreshContext(
          state,
          capturedCommits,
          'NOT-REAL-ID',
        ),
      )
    })
  })

  describe('cleanSuccessfulLocalRecordsRemoteHasEchoed', () => {
    const obsStore = getOrCreateInstance(cc.lfWowObsStoreName)

    beforeEach(async () => {
      await obsStore.clear()
    })

    afterAll(async () => {
      await obsStore.clear()
    })

    it('should delete a successful new record that remote has echoed back', async () => {
      await obsStore.setItem('123A', { uuid: '123A' })
      const state = {
        allRemoteObs: [{ uuid: '123A' }],
        localQueueSummary: [
          {
            uuid: '123A',
            [cc.recordProcessingOutcomeFieldName]: 'success',
            [cc.recordTypeFieldName]: 'new',
          },
        ],
      }
      await objectUnderTest.actions.cleanSuccessfulLocalRecordsRemoteHasEchoed(
        await buildDumbContext(
          {
            state,
            getters: {
              successfulLocalQueueSummary: objectUnderTest.getters.successfulLocalQueueSummary(
                state,
              ),
              deletesWithErrorDbIds: objectUnderTest.getters.deletesWithErrorDbIds(
                state,
              ),
            },
          },
          ['checkForLostPhotos'],
        ),
      )
      const result = await obsStore.getItem('123A')
      expect(result).toBeNull()
    })

    it(
      'should delete a successful edit record that remote has echoed back with' +
        ' a newer updatedAt date',
      async () => {
        await obsStore.setItem('456B', { uuid: '456B' })
        const state = {
          allRemoteObs: [
            { uuid: '456B', updatedAt: '2019-01-01T02:22:22.222Z' },
          ],
          localQueueSummary: [
            {
              uuid: '456B',
              [cc.recordProcessingOutcomeFieldName]: 'success',
              [cc.recordTypeFieldName]: 'edit',
              wowUpdatedAt: '2019-01-01T01:11:11.111Z',
            },
          ],
        }
        await objectUnderTest.actions.cleanSuccessfulLocalRecordsRemoteHasEchoed(
          await buildDumbContext(
            {
              state,
              getters: {
                successfulLocalQueueSummary: objectUnderTest.getters.successfulLocalQueueSummary(
                  state,
                ),
                deletesWithErrorDbIds: objectUnderTest.getters.deletesWithErrorDbIds(
                  state,
                ),
              },
            },
            ['checkForLostPhotos'],
          ),
        )
        const result = await obsStore.getItem('456B')
        expect(result).toBeNull()
      },
    )

    it(
      'should NOT delete a successful edit record that remote has echoed back ' +
        'with an older updatedAt date, because it has not been processed yet',
      async () => {
        await obsStore.setItem('456B', { uuid: '456B' })
        const state = {
          allRemoteObs: [
            { uuid: '456B', updatedAt: '2019-01-01T02:22:22.222Z' },
          ],
          localQueueSummary: [
            {
              uuid: '456B',
              [cc.recordProcessingOutcomeFieldName]: 'success',
              [cc.recordTypeFieldName]: 'edit',
              wowUpdatedAt: '2019-01-01T03:33:33.333Z',
            },
          ],
        }
        await objectUnderTest.actions.cleanSuccessfulLocalRecordsRemoteHasEchoed(
          {
            state,
            getters: {
              successfulLocalQueueSummary: objectUnderTest.getters.successfulLocalQueueSummary(
                state,
              ),
              deletesWithErrorDbIds: objectUnderTest.getters.deletesWithErrorDbIds(
                state,
              ),
            },
            dispatch: () => {},
          },
        )
        const result = await obsStore.getItem('456B')
        expect(result).not.toBeNull()
      },
    )

    it('should delete a successful delete record that is not in remote obs list', async () => {
      await obsStore.setItem('456B', { uuid: '456B' })
      const state = {
        allRemoteObs: [],
        localQueueSummary: [
          {
            uuid: '456B',
            [cc.recordProcessingOutcomeFieldName]: 'success',
            [cc.recordTypeFieldName]: 'delete',
          },
        ],
      }
      await objectUnderTest.actions.cleanSuccessfulLocalRecordsRemoteHasEchoed(
        await buildDumbContext(
          {
            state,
            getters: {
              successfulLocalQueueSummary: objectUnderTest.getters.successfulLocalQueueSummary(
                state,
              ),
              deletesWithErrorDbIds: objectUnderTest.getters.deletesWithErrorDbIds(
                state,
              ),
            },
          },
          ['checkForLostPhotos'],
        ),
      )
      const result = await obsStore.getItem('456B')
      expect(result).toBeNull()
    })

    it('should delete a "delete" record with error that is not in remote obs list', async () => {
      await obsStore.setItem('456B', { uuid: '456B' })
      const state = {
        allRemoteObs: [],
        localQueueSummary: [
          {
            uuid: '456B',
            [cc.recordProcessingOutcomeFieldName]: 'systemError',
            [cc.recordTypeFieldName]: 'delete',
          },
        ],
      }
      await objectUnderTest.actions.cleanSuccessfulLocalRecordsRemoteHasEchoed(
        await buildDumbContext(
          {
            state,
            getters: {
              successfulLocalQueueSummary: objectUnderTest.getters.successfulLocalQueueSummary(
                state,
              ),
              deletesWithErrorDbIds: objectUnderTest.getters.deletesWithErrorDbIds(
                state,
              ),
            },
          },
          ['checkForLostPhotos'],
        ),
      )
      const result = await obsStore.getItem('456B')
      expect(result).toBeNull()
    })

    it('should trigger a blocked action', async () => {
      const existingLocalPhoto = { id: 11, testTag: 'photo1 placeholder' }
      const existingBlockedLocalPhoto = {
        id: 22,
        testTag: 'photo2 placeholder',
      }
      await obsStore.setItem('456B', {
        uuid: '456B',
        photos: [existingLocalPhoto, existingBlockedLocalPhoto],
        wowMeta: {
          [cc.photosToAddFieldName]: [existingLocalPhoto],
          [cc.blockedActionFieldName]: {
            wowMeta: {
              [cc.recordTypeFieldName]: 'edit',
              [cc.photoIdsToDeleteFieldName]: [111],
              [cc.recordProcessingOutcomeFieldName]: 'waiting',
              [cc.photosToAddFieldName]: [existingBlockedLocalPhoto],
            },
          },
        },
      })
      const state = {
        allRemoteObs: [{ uuid: '456B', inatId: 987 }],
        localQueueSummary: [
          {
            uuid: '456B',
            [cc.recordProcessingOutcomeFieldName]: 'success',
            [cc.recordTypeFieldName]: 'new',
            [cc.hasBlockedActionFieldName]: true,
          },
        ],
      }
      await objectUnderTest.actions.cleanSuccessfulLocalRecordsRemoteHasEchoed(
        await buildDumbContext(
          {
            state,
            getters: {
              successfulLocalQueueSummary: objectUnderTest.getters.successfulLocalQueueSummary(
                state,
              ),
              deletesWithErrorDbIds: objectUnderTest.getters.deletesWithErrorDbIds(
                state,
              ),
            },
          },
          ['checkForLostPhotos', 'refreshLocalRecordQueue'],
        ),
      )
      const result = await obsStore.getItem('456B')
      expect(result.inatId).toEqual(987)
      expect(result.wowMeta).toEqual({
        [cc.recordTypeFieldName]: 'edit',
        [cc.recordProcessingOutcomeFieldName]: 'waiting',
        [cc.photoIdsToDeleteFieldName]: [111],
        [cc.photosToAddFieldName]: [
          {
            id: 22,
            testTag: 'photo2 placeholder',
            thumb: true,
          },
        ],
        [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
        [cc.versionFieldName]: cc.currentRecordVersion,
      })
    })
  })

  describe('findDbIdForWowId', () => {
    const obsStore = getOrCreateInstance(cc.lfWowObsStoreName)

    beforeEach(async () => {
      await obsStore.clear()
    })

    afterAll(async () => {
      await obsStore.clear()
    })

    it('should find the ID when we provide an inatId', async () => {
      const state = {
        localQueueSummary: [
          { uuid: '123A', inatId: 111 },
          { uuid: '468A', inatId: 333 },
        ],
      }
      const result = await objectUnderTest.actions.findDbIdForWowId(
        {
          state,
          dispatch: () => {},
        },
        111,
      )
      expect(result).toEqual('123A')
    })

    it('should find the ID when we provide a db record ID', async () => {
      await obsStore.setItem('123A', {
        uuid: '123A',
      })
      const state = {
        localQueueSummary: [
          { uuid: '123A', inatId: 111 },
          { uuid: '468A', inatId: 333 },
        ],
      }
      const result = await objectUnderTest.actions.findDbIdForWowId(
        {
          state,
          dispatch: () => {},
        },
        '123A',
      )
      expect(result).toEqual('123A')
    })

    it('should find the ID on second try when we provide a db record ID', async () => {
      await obsStore.setItem('123A', {
        uuid: '123A',
      })
      const state = {
        localQueueSummary: [{ uuid: '468A', inatId: 333 }],
      }
      const result = await objectUnderTest.actions.findDbIdForWowId(
        {
          state,
          dispatch: actionName => {
            if (actionName !== 'refreshLocalRecordQueue') {
              throw new Error(`Unhandled action name=${actionName}`)
            }
            state.localQueueSummary = [
              { uuid: '123A', inatId: 111 },
              { uuid: '468A', inatId: 333 },
            ]
          },
        },
        '123A',
      )
      expect(result).toEqual('123A')
    })

    it('should throw the expected error when we ask for a non-existant ID', async () => {
      const state = {
        localQueueSummary: [],
      }
      try {
        await objectUnderTest.actions.findDbIdForWowId(
          {
            state,
            dispatch: () => {},
          },
          '123A',
        )
      } catch (err) {
        if (err.name === 'DbRecordNotFoundError') {
          // success
          return
        }
        throw err
      }
      throw new Error('Fail, expected error')
    })

    it('should not try to lookup a DB record in IndexedDB by "number" typed ID', async () => {
      const wowId = 3337
      const origConsoleWarn = console.warn
      console.warn = () => {}
      await obsStore.setItem(wowId, {
        uuid:
          'A temp-ing fake. Real LocalForage will not allow numbers ' +
          'as keys, but our test DB will',
      })
      console.warn = origConsoleWarn
      const state = {
        localQueueSummary: [],
      }
      const result = await objectUnderTest.actions.findDbIdForWowId(
        {
          state,
          dispatch: actionName => {
            if (actionName !== 'refreshLocalRecordQueue') {
              throw new Error(`Unhandled action name=${actionName}`)
            }
            state.localQueueSummary = [{ uuid: 'WINNER', inatId: wowId }]
          },
        },
        wowId,
      )
      expect(result).toEqual('WINNER')
    })
  })

  describe('inatIdToUuid', () => {
    it('should find the UUID when a local record exists', async () => {
      const getters = {
        localRecords: [
          {
            uuid: '123A',
            inatId: 111,
          },
        ],
        remoteRecords: [],
      }
      const result = await objectUnderTest.actions.inatIdToUuid(
        await buildDumbContext({ getters }),
        111,
      )
      expect(result).toEqual('123A')
    })

    it('should find the UUID when a remote record exists', async () => {
      const getters = {
        localRecords: [],
        remoteRecords: [
          {
            uuid: '123A',
            inatId: 111,
          },
        ],
      }
      const result = await objectUnderTest.actions.inatIdToUuid(
        await buildDumbContext({ getters }),
        111,
      )
      expect(result).toEqual('123A')
    })

    it('should return null when no record exists', async () => {
      const getters = {
        localRecords: [],
        remoteRecords: [],
      }
      const result = await objectUnderTest.actions.inatIdToUuid(
        await buildDumbContext({ getters }),
        111,
      )
      expect(result).toBeNull()
    })
  })

  describe('getCurrentOutcomeForWowId', () => {
    it('should find the outcome when a record exists and we use UUID', async () => {
      const state = {
        localQueueSummary: [
          {
            uuid: '123A',
            inatId: 111,
            [cc.recordProcessingOutcomeFieldName]: cc.waitingOutcome,
          },
        ],
      }
      const result = await objectUnderTest.actions.getCurrentOutcomeForWowId(
        await buildDumbContext({ state }),
        '123A',
      )
      expect(result).toEqual('waiting')
    })

    it('should find the outcome when a record exists and we use iNat ID', async () => {
      const state = {
        localQueueSummary: [
          {
            uuid: '123A',
            inatId: 111,
            [cc.recordProcessingOutcomeFieldName]: cc.beingProcessedOutcome,
          },
        ],
      }
      const result = await objectUnderTest.actions.getCurrentOutcomeForWowId(
        await buildDumbContext({ state }),
        111,
      )
      expect(result).toEqual('withLocalProcessor')
    })

    it('should throw the expected error when no record exists', async () => {
      const state = {
        localQueueSummary: [],
      }
      try {
        await objectUnderTest.actions.getCurrentOutcomeForWowId(
          await buildDumbContext({ state }),
          'NO-RECORD-WITH-UUID',
        )
      } catch (err) {
        expect(err.message).toEqual(
          expect.stringMatching(/^Could not find record with wowId=NO-RECORD/),
        )
        return
      }
      throw new Error('Expected error should have been thrown')
    })
  })
})

describe('extractGeolocationText', () => {
  it('should get coords from a record in our domain', () => {
    const localRecord = {
      lat: 44.12345678,
      lng: 33.12345678,
    }
    const result = extractGeolocationText(localRecord)
    expect(result).toEqual('33.123457,44.123457')
  })

  it('should get a place guess', () => {
    const record = {
      placeGuess: 'some place',
    }
    const result = extractGeolocationText(record)
    expect(result).toEqual('some place')
  })

  it('should fallback to a placeholder if nothing is found', () => {
    const record = { geojson: null }
    const result = extractGeolocationText(record)
    expect(result).toEqual('(No place guess)')
  })
})

describe('mapObsFromApiIntoOurDomain', () => {
  it('should map a record with everything', () => {
    const record = getApiRecord()
    const result = _testonly.mapObsFromApiIntoOurDomain(record)
    expect(result).toHaveProperty('inatId', 42)
    expect(result).toHaveProperty('photos', [
      {
        id: 13,
        uuid: 'd7e2c89a-0741-4ce8-8b9c-c5992bfe6727',
        url:
          'http://dev.inat.techotom.com/attachments/local_photos/files/14/square/10425011_10152561992129730_7715615756023856816_n.jpg?1563423348',
        isRemote: true,
      },
      {
        id: 14,
        uuid: '557fc632-637f-4093-ad2f-74540c980fc1',
        url:
          'http://dev.inat.techotom.com/attachments/local_photos/files/15/square/10501641_10152561922694730_8539909549430640775_n.jpg?1563423350',
        isRemote: true,
      },
    ])
    expect(result.placeGuess).toBeNull()
    expect(result).toHaveProperty('speciesGuess', 'a species guess')
    expect(result).toHaveProperty('obsFieldValues', [
      {
        fieldId: 1,
        relationshipId: 4,
        datatype: 'text',
        name: 'Orchid type',
        value: 'Terrestrial',
      },
    ])
    expect(result).toHaveProperty('notes', 'some notes')
  })
})

describe('getters', () => {
  describe('obsFieldPositions', () => {
    it('should generate the expected position mapping', () => {
      const getters = {
        obsFields: [
          { id: 11, position: 0 },
          { id: 22, position: 2 },
          { id: 666, position: 1 },
        ],
      }
      const result = objectUnderTest.getters.obsFieldPositions(null, getters)
      expect(result).toEqual({
        [11]: 0,
        [22]: 2,
        [666]: 1,
      })
    })
  })
})

async function buildDumbContext({ state, getters }, stubbedDispatchNames = []) {
  const result = {
    state: {
      allRemoteObs: [],
      ...state,
    },
    commit: () => {},
    getters: {
      ...getters,
    },
    dispatch: async (actionName, argsObj) => {
      if (stubbedDispatchNames.includes(actionName)) {
        return
      }
      const availableActions = Object.assign({}, objectUnderTest.actions, {
        processLocalQueue: () => Promise.resolve(),
      })
      const action = availableActions[actionName]
      if (!action) {
        console.error(
          `Cannot find action with name='${actionName}'` + '. Passed args = ',
          argsObj,
        )
        return // can't throw because there's nothing to catch
      }
      return action(result, argsObj)
    },
  }
  return result
}

async function buildAutoQueueRefreshContext(
  state,
  capturedCommits,
  selectedObservationUuid,
) {
  const result = await buildDumbContext({
    state: {
      _uiVisibleLocalRecords: [],
      localQueueSummary: [],
      selectedObservationUuid,
      allRemoteObs: [],
      ...state,
    },
  })
  result.commit = (name, value) => {
    switch (name) {
      case 'setLocalQueueSummary':
      case 'setUiVisibleLocalRecords':
        objectUnderTest.mutations[name](result.state, value)
        refreshGetters()
        break
      default:
        capturedCommits[name] = value
    }
  }
  await objectUnderTest.actions.refreshLocalRecordQueue(result)
  return result
  function refreshGetters() {
    result.getters.localRecords = objectUnderTest.getters.localRecords(
      result.state,
    )
  }
}

function getApiRecord() {
  return {
    out_of_range: null,
    quality_grade: 'casual',
    time_observed_at: null,
    taxon_geoprivacy: null,
    annotations: [],
    context_user_geoprivacy: null,
    uuid: '765148bd-cd29-4be2-ab5c-6a5e8574561f',
    observed_on_details: null,
    id: 42,
    cached_votes_total: 0,
    identifications_most_agree: false,
    created_at_details: {
      date: '2019-07-18',
      week: 29,
      month: 7,
      hour: 13,
      year: 2019,
      day: 18,
    },
    species_guess: 'a species guess',
    identifications_most_disagree: false,
    tags: [],
    positional_accuracy: 3739,
    comments_count: 0,
    site_id: 1,
    created_time_zone: 'Australia/Adelaide',
    id_please: false,
    license_code: 'cc-by-nc',
    observed_time_zone: 'Australia/Adelaide',
    quality_metrics: [],
    public_positional_accuracy: 3739,
    reviewed_by: [],
    context_geoprivacy: null,
    oauth_application_id: 3,
    flags: [],
    created_at: '2019-07-18T13:45:47+09:30',
    description: 'some notes',
    time_zone_offset: '+09:30',
    project_ids_with_curator_id: [],
    observed_on: null,
    observed_on_string: null,
    updated_at: '2019-07-18T13:45:53+09:30',
    sounds: [],
    place_ids: [],
    captive: false,
    taxon: null,
    ident_taxon_ids: [],
    outlinks: [],
    faves_count: 0,
    context_taxon_geoprivacy: null,
    ofvs: [
      {
        field_id: 1,
        datatype: 'text',
        user_id: 1,
        value_ci: 'Terrestrial',
        name: 'WOW Orchid type',
        name_ci: 'WOW Orchid type',
        id: 4,
        uuid: 'd2c90b63-7218-4397-acd5-907003a9c363',
        value: 'Terrestrial',
        user: {
          id: 1,
          login: 'tom',
          spam: false,
          suspended: false,
          created_at: '2019-07-12T07:00:52+00:00',
          login_autocomplete: 'tom',
          login_exact: 'tom',
          name: '',
          name_autocomplete: '',
          orcid: null,
          icon: '/attachments/users/icons/1-thumb.png?1562917786',
          observations_count: 38,
          identifications_count: 0,
          journal_posts_count: 0,
          activity_count: 38,
          universal_search_rank: 38,
          roles: [],
          site_id: 1,
          icon_url: '/attachments/users/icons/1-medium.png?1562917786',
        },
        observation_field: {
          id: 1,
          name: 'WOW Orchid type',
          name_autocomplete: 'WOW Orchid type',
          description: 'Type of orchid',
          description_autocomplete: 'Type of orchid',
          datatype: 'text',
          allowed_values: 'Terrestrial|Epiphyte|Lithophyte',
          values_count: 4,
          users_count: 1,
        },
      },
    ],
    num_identification_agreements: 0,
    preferences: {
      auto_obscuration: true,
      prefers_community_taxon: null,
    },
    comments: [],
    map_scale: null,
    uri: 'http://dev.inat.techotom.com/observations/42',
    project_ids: [],
    community_taxon_id: null,
    geojson: {
      coordinates: ['138.62912', '-34.9749248'],
      type: 'Point',
    },
    owners_identification_from_vision: null,
    identifications_count: 0,
    obscured: false,
    num_identification_disagreements: 0,
    geoprivacy: null,
    location: '-34.9749248,138.62912',
    votes: [],
    spam: false,
    user: {
      created_at: '2019-07-12T07:00:52+00:00',
      id: 1,
      login: 'tom',
      spam: false,
      suspended: false,
      login_autocomplete: 'tom',
      login_exact: 'tom',
      name: '',
      name_autocomplete: '',
      orcid: null,
      icon: '/attachments/users/icons/1-thumb.png?1562917786',
      observations_count: 38,
      identifications_count: 0,
      journal_posts_count: 0,
      activity_count: 38,
      universal_search_rank: 38,
      roles: [],
      site_id: 1,
      icon_url: '/attachments/users/icons/1-medium.png?1562917786',
      preferences: {},
    },
    mappable: true,
    identifications_some_agree: false,
    project_ids_without_curator_id: [],
    place_guess: null,
    identifications: [],
    project_observations: [],
    photos: [
      {
        id: 14,
        license_code: 'cc-by-nc',
        url:
          'http://dev.inat.techotom.com/attachments/local_photos/files/14/square/10425011_10152561992129730_7715615756023856816_n.jpg?1563423348',
        attribution: '(c) tom, some rights reserved (CC BY-NC)',
        original_dimensions: {
          width: 960,
          height: 726,
        },
        flags: [],
      },
      {
        id: 15,
        license_code: 'cc-by-nc',
        url:
          'http://dev.inat.techotom.com/attachments/local_photos/files/15/square/10501641_10152561922694730_8539909549430640775_n.jpg?1563423350',
        attribution: '(c) tom, some rights reserved (CC BY-NC)',
        original_dimensions: {
          width: 960,
          height: 720,
        },
        flags: [],
      },
    ],
    observation_photos: [
      {
        id: 13,
        position: 0,
        uuid: 'd7e2c89a-0741-4ce8-8b9c-c5992bfe6727',
        photo: {
          id: 14,
          license_code: 'cc-by-nc',
          url:
            'http://dev.inat.techotom.com/attachments/local_photos/files/14/square/10425011_10152561992129730_7715615756023856816_n.jpg?1563423348',
          attribution: '(c) tom, some rights reserved (CC BY-NC)',
          original_dimensions: {
            width: 960,
            height: 726,
          },
          flags: [],
        },
      },
      {
        id: 14,
        position: 1,
        uuid: '557fc632-637f-4093-ad2f-74540c980fc1',
        photo: {
          id: 15,
          license_code: 'cc-by-nc',
          url:
            'http://dev.inat.techotom.com/attachments/local_photos/files/15/square/10501641_10152561922694730_8539909549430640775_n.jpg?1563423350',
          attribution: '(c) tom, some rights reserved (CC BY-NC)',
          original_dimensions: {
            width: 960,
            height: 720,
          },
          flags: [],
        },
      },
    ],
    application: {
      id: 3,
      name: 'wow-local-dev',
      url: 'https://www.inaturalist.org/oauth/applications/3',
      icon: 'https://www.google.com/s2/favicons?domain=www.inaturalist.org',
    },
    faves: [],
    non_owner_ids: [],
  }
}
