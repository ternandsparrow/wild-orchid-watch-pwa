import { getOrCreateInstance } from '@/indexeddb/storage-manager'
import * as cc from '@/misc/constants'
import objectUnderTest, { _testonly, extractGeolocationText } from '@/store/obs'
import { _testonly as workerTestOnly } from '@/misc/web.worker'
import { _testonly as obsStoreCommonTestOnly } from '@/indexeddb/obs-store-common'

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
      const action = objectUnderTest.actions[actionName]
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
