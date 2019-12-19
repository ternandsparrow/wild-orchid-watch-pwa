import { getOrCreateInstance } from '@/indexeddb/storage-manager'
import * as constants from '@/misc/constants'
import objectUnderTest, { _testonly, extractGeolocationText } from '@/store/obs'

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
  describe('waitForProjectInfo', () => {
    let origConsoleDebug

    beforeAll(function() {
      origConsoleDebug = console.debug
      console.debug = () => {}
    })

    afterAll(function() {
      console.debug = origConsoleDebug
    })

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

  describe('edit strategies', () => {
    const obsStore = getOrCreateInstance('wow-obs')

    beforeEach(async () => {
      await obsStore.clear()
    })

    describe('upsertQueuedAction', () => {
      it('should create the record when none exists', async () => {
        const record = {
          uuid: '123A',
          testRecord: true,
          wowMeta: {},
        }
        await objectUnderTest.actions.upsertQueuedAction(null, { record })
        const result = await obsStore.getItem('123A')
        expect(result.testRecord).toBeTruthy()
        expect(
          result.wowMeta[constants.recordProcessingOutcomeFieldName],
        ).toEqual('waiting')
      })

      it('should clobber the record when one already exists', async () => {
        await obsStore.setItem('123A', {
          uuid: '123A',
          existingRecord: true,
          wowMeta: {},
        })
        const record = {
          uuid: '123A',
          testRecord: true,
          wowMeta: {},
        }
        await objectUnderTest.actions.upsertQueuedAction(null, { record })
        const result = await obsStore.getItem('123A')
        expect(result.testRecord).toBeTruthy()
        expect(result.existingRecord).toBeFalsy()
      })

      it('should merge obsFieldIdsToDelete with the existing', async () => {
        await obsStore.setItem('123A', {
          uuid: '123A',
          wowMeta: {
            [constants.obsFieldIdsToDeleteFieldName]: [11, 22, 33],
          },
        })
        const record = {
          uuid: '123A',
          wowMeta: {
            [constants.obsFieldIdsToDeleteFieldName]: [11, 22, 33],
          },
        }
        const newObsFieldIdsToDelete = [44]
        await objectUnderTest.actions.upsertQueuedAction(null, {
          record,
          obsFieldIdsToDelete: newObsFieldIdsToDelete,
        })
        const result = await obsStore.getItem('123A')
        expect(result.wowMeta[constants.obsFieldIdsToDeleteFieldName]).toEqual([
          11,
          22,
          33,
          44,
        ])
      })

      it('should merge photoIdsToDelete with the existing', async () => {
        await obsStore.setItem('123A', {
          uuid: '123A',
          wowMeta: {
            [constants.photoIdsToDeleteFieldName]: [11, 22, 33],
          },
        })
        const record = {
          uuid: '123A',
          wowMeta: {
            [constants.photoIdsToDeleteFieldName]: [11, 22, 33],
          },
        }
        const newPhotoIdsToDelete = [44]
        await objectUnderTest.actions.upsertQueuedAction(null, {
          record,
          obsFieldIdsToDelete: [],
          photoIdsToDelete: newPhotoIdsToDelete,
        })
        const result = await obsStore.getItem('123A')
        expect(result.wowMeta[constants.photoIdsToDeleteFieldName]).toEqual([
          11,
          22,
          33,
          44,
        ])
      })
    })

    describe('upsertBlockedAction', () => {
      it('should create the blocked action when none exists', async () => {
        await obsStore.setItem('123A', {
          uuid: '123A',
          someField: 'old value',
          wowMeta: {
            [constants.recordTypeFieldName]: 'new',
            [constants.blockedActionFieldName]: null,
          },
        })
        const record = {
          uuid: '123A',
          someField: 'new value',
          wowMeta: {
            [constants.recordTypeFieldName]: 'edit',
          },
        }
        const newPhotoIdsToDelete = []
        const newObsFieldIdsToDelete = []
        await objectUnderTest.actions.upsertBlockedAction(null, {
          record,
          photoIdsToDelete: newPhotoIdsToDelete,
          obsFieldIdsToDelete: newObsFieldIdsToDelete,
        })
        const result = await obsStore.getItem('123A')
        expect(result.someField).toEqual('new value')
        expect(result.wowMeta[constants.recordTypeFieldName]).toEqual('new')
        expect(
          result.wowMeta[constants.blockedActionFieldName].wowMeta[
            constants.recordTypeFieldName
          ],
        ).toEqual('edit')
      })

      it(
        'should only merge the {photos,obsFields}IdsToDelete with the existing ' +
          'blocked action, but leave the record xToDelete values alone',
        async () => {
          await obsStore.setItem('123A', {
            uuid: '123A',
            wowMeta: {
              [constants.recordTypeFieldName]: 'new',
              [constants.photoIdsToDeleteFieldName]: [21, 22],
              [constants.obsFieldIdsToDeleteFieldName]: [31, 32],
              [constants.blockedActionFieldName]: {
                wowMeta: {
                  [constants.photoIdsToDeleteFieldName]: [23, 24],
                  [constants.obsFieldIdsToDeleteFieldName]: [33, 34],
                },
              },
            },
          })
          const record = {
            uuid: '123A',
            wowMeta: {
              [constants.recordTypeFieldName]: 'edit',
            },
          }
          const newPhotoIdsToDelete = [25, 26]
          const newObsFieldIdsToDelete = [35, 36]
          await objectUnderTest.actions.upsertBlockedAction(null, {
            record,
            photoIdsToDelete: newPhotoIdsToDelete,
            obsFieldIdsToDelete: newObsFieldIdsToDelete,
          })
          const result = await obsStore.getItem('123A')
          expect(result.wowMeta[constants.photoIdsToDeleteFieldName]).toEqual([
            21,
            22,
          ])
          expect(
            result.wowMeta[constants.obsFieldIdsToDeleteFieldName],
          ).toEqual([31, 32])
          expect(
            result.wowMeta[constants.blockedActionFieldName].wowMeta[
              constants.photoIdsToDeleteFieldName
            ],
          ).toEqual([23, 24, 25, 26])
          expect(
            result.wowMeta[constants.blockedActionFieldName].wowMeta[
              constants.obsFieldIdsToDeleteFieldName
            ],
          ).toEqual([33, 34, 35, 36])
        },
      )
    })

    it('should reset localForage store for each test', async () => {
      // not completely foolproof but a canary to verify beforeEach
      const result = (await obsStore.keys()).length
      expect(result).toEqual(0)
    })
  })

  describe('refreshLocalRecordQueue', () => {
    const obsStore = getOrCreateInstance('wow-obs')

    beforeEach(async () => {
      await obsStore.clear()
    })

    it('should see a new record as UI visible', async () => {
      const record = {
        uuid: '123A',
        photos: [],
        wowMeta: {
          [constants.recordTypeFieldName]: 'new',
          [constants.recordProcessingOutcomeFieldName]: 'waiting',
        },
      }
      await obsStore.setItem('123A', record)
      const committedState = {}
      await objectUnderTest.actions.refreshLocalRecordQueue({
        commit: (key, value) => (committedState[key] = value),
      })
      expect(committedState.setLocalQueueSummary).toEqual([
        {
          [constants.recordTypeFieldName]: 'new',
          [constants.isEventuallyDeletedFieldName]: false,
          [constants.recordProcessingOutcomeFieldName]: 'waiting',
          [constants.hasBlockedActionFieldName]: false,
          inatId: undefined,
          uuid: '123A',
        },
      ])
      expect(committedState.setUiVisibleLocalRecords).toEqual([
        {
          geolocationAccuracy: undefined,
          photos: [],
          uuid: '123A',
          wowMeta: {
            [constants.recordTypeFieldName]: 'new',
            [constants.recordProcessingOutcomeFieldName]: 'waiting',
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
          [constants.recordTypeFieldName]: 'edit',
          [constants.recordProcessingOutcomeFieldName]: 'withServiceWorker',
          [constants.blockedActionFieldName]: {
            uuid: '123A',
            inatId: 33,
            photos: [],
            wowMeta: {
              [constants.recordTypeFieldName]: 'delete',
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
          [constants.recordTypeFieldName]: 'edit',
          [constants.isEventuallyDeletedFieldName]: true,
          [constants.recordProcessingOutcomeFieldName]: 'withServiceWorker',
          [constants.hasBlockedActionFieldName]: true,
          inatId: 33,
          uuid: '123A',
        },
      ])
      expect(committedState.setUiVisibleLocalRecords).toEqual([])
    })
  })

  describe('cleanSuccessfulLocalRecordsRemoteHasEchoed', () => {
    const obsStore = getOrCreateInstance('wow-obs')
    let origConsoleDebug

    beforeAll(function() {
      origConsoleDebug = console.debug
      console.debug = () => {}
    })

    afterAll(function() {
      console.debug = origConsoleDebug
    })

    beforeEach(async () => {
      await obsStore.clear()
    })

    it('should delete a successful new record that remote has echoed back', async () => {
      await obsStore.setItem('123A', { uuid: '123A' })
      const state = {
        allRemoteObs: [{ uuid: '123A' }],
        localQueueSummary: [
          {
            uuid: '123A',
            [constants.recordProcessingOutcomeFieldName]: 'success',
            [constants.recordTypeFieldName]: 'new',
          },
        ],
      }
      await objectUnderTest.actions.cleanSuccessfulLocalRecordsRemoteHasEchoed({
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
      })
      const result = await obsStore.getItem('123A')
      expect(result).toBeNull()
    })

    it('should delete a successful edit record that remote has echoed back', async () => {
      await obsStore.setItem('456B', { uuid: '456B' })
      const state = {
        allRemoteObs: [{ uuid: '456B' }],
        localQueueSummary: [
          {
            uuid: '456B',
            [constants.recordProcessingOutcomeFieldName]: 'success',
            [constants.recordTypeFieldName]: 'edit',
          },
        ],
      }
      await objectUnderTest.actions.cleanSuccessfulLocalRecordsRemoteHasEchoed({
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
      })
      const result = await obsStore.getItem('456B')
      expect(result).toBeNull()
    })

    it('should delete a successful delete record that is not in remote obs list', async () => {
      await obsStore.setItem('456B', { uuid: '456B' })
      const state = {
        allRemoteObs: [],
        localQueueSummary: [
          {
            uuid: '456B',
            [constants.recordProcessingOutcomeFieldName]: 'success',
            [constants.recordTypeFieldName]: 'delete',
          },
        ],
      }
      await objectUnderTest.actions.cleanSuccessfulLocalRecordsRemoteHasEchoed({
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
      })
      const result = await obsStore.getItem('456B')
      expect(result).toBeNull()
    })

    it('should delete a delete record with error that is not in remote obs list', async () => {
      await obsStore.setItem('456B', { uuid: '456B' })
      const state = {
        allRemoteObs: [],
        localQueueSummary: [
          {
            uuid: '456B',
            [constants.recordProcessingOutcomeFieldName]: 'systemError',
            [constants.recordTypeFieldName]: 'delete',
          },
        ],
      }
      await objectUnderTest.actions.cleanSuccessfulLocalRecordsRemoteHasEchoed({
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
      })
      const result = await obsStore.getItem('456B')
      expect(result).toBeNull()
    })

    it('should trigger a blocked action', async () => {
      await obsStore.setItem('456B', {
        uuid: '456B',
        wowMeta: {
          [constants.blockedActionFieldName]: {
            wowMeta: {
              [constants.recordTypeFieldName]: 'edit',
              [constants.photoIdsToDeleteFieldName]: [111],
            },
          },
        },
      })
      const state = {
        allRemoteObs: [{ uuid: '456B' }],
        localQueueSummary: [
          {
            uuid: '456B',
            [constants.recordProcessingOutcomeFieldName]: 'success',
            [constants.recordTypeFieldName]: 'new',
            [constants.hasBlockedActionFieldName]: true,
          },
        ],
      }
      await objectUnderTest.actions.cleanSuccessfulLocalRecordsRemoteHasEchoed({
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
      })
      const result = await obsStore.getItem('456B')
      expect(result.wowMeta[constants.recordTypeFieldName]).toEqual('edit')
      expect(result.wowMeta[constants.photoIdsToDeleteFieldName]).toEqual([111])
    })

    // FIXME what about adding a photo in the main record and another in the
    // blocked action? We don't want to double upload that first new photo so
    // we need to refresh the record with what we have from the remote before
    // we process the blocked action
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
        id: 14,
        licenseCode: 'cc-by-nc',
        url:
          'http://dev.inat.techotom.com/attachments/local_photos/files/14/square/10425011_10152561992129730_7715615756023856816_n.jpg?1563423348',
        attribution: '(c) tom, some rights reserved (CC BY-NC)',
        isRemote: true,
      },
      {
        id: 15,
        licenseCode: 'cc-by-nc',
        url:
          'http://dev.inat.techotom.com/attachments/local_photos/files/15/square/10501641_10152561922694730_8539909549430640775_n.jpg?1563423350',
        attribution: '(c) tom, some rights reserved (CC BY-NC)',
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
