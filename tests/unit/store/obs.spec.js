import dayjs from 'dayjs'
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
    const obsStore = getOrCreateInstance('wow-obs')

    beforeEach(async () => {
      await obsStore.clear()
    })

    afterAll(async () => {
      await obsStore.clear()
    })

    describe('saveNewAndScheduleUpload', () => {
      it('should save a new record without photos', async () => {
        const record = {
          speciesGuess: 'species new',
          addedPhotos: [],
          observedAt: 1595491950028,
        }
        const dispatchedStuff = {}
        const newRecordId = await objectUnderTest.actions.saveNewAndScheduleUpload(
          {
            dispatch: (actionName, theArg) =>
              (dispatchedStuff[actionName] = theArg),
          },
          { record, isDraft: true },
        )
        const result = await obsStore.getItem(newRecordId)
        expect(result).toEqual({
          captive_flag: false,
          geoprivacy: 'obscured',
          observedAt: 1595491950028,
          photos: [],
          speciesGuess: 'species new',
          uuid: newRecordId,
          wowMeta: {
            recordType: 'new',
            [constants.photosToAddFieldName]: [],
            [constants.photoIdsToDeleteFieldName]: [],
            [constants.obsFieldIdsToDeleteFieldName]: [],
            [constants.recordProcessingOutcomeFieldName]: 'draft',
            [constants.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
            [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
          },
        })
      })

      it('should save a new record with photos', async () => {
        const record = {
          speciesGuess: 'species new',
          addedPhotos: [
            {
              file: getMinimalJpegBlob(),
              type: 'top',
            },
            {
              file: getMinimalJpegBlob(),
              type: 'habitat',
            },
          ],
        }
        const dispatchedStuff = {}
        const newRecordId = await objectUnderTest.actions.saveNewAndScheduleUpload(
          {
            dispatch: (actionName, theArg) =>
              (dispatchedStuff[actionName] = theArg),
          },
          { record, isDraft: false },
        )
        const result = await obsStore.getItem(newRecordId)
        const expectedPhoto1 = {
          file: {
            data: {}, // doesn't show up in str representation
            mime: 'image/jpeg',
          },
          id: -1,
          type: 'top',
          url: '(set at render time)',
        }
        const expectedPhoto2 = {
          file: {
            data: {}, // doesn't show up in str representation
            mime: 'image/jpeg',
          },
          id: -2,
          type: 'habitat',
          url: '(set at render time)',
        }
        expect(result).toEqual({
          captive_flag: false,
          geoprivacy: 'obscured',
          photos: [expectedPhoto1, expectedPhoto2],
          speciesGuess: 'species new',
          uuid: newRecordId,
          wowMeta: {
            recordType: 'new',
            [constants.photosToAddFieldName]: [expectedPhoto1, expectedPhoto2],
            [constants.photoIdsToDeleteFieldName]: [],
            [constants.obsFieldIdsToDeleteFieldName]: [],
            [constants.recordProcessingOutcomeFieldName]: 'waiting',
            [constants.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
            [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
          },
        })
      })
    })

    describe('saveEditAndScheduleUpdate', () => {
      it('should save an edit that changes the speciesGuess on an existing local edit', async () => {
        const record = {
          uuid: '123A',
          speciesGuess: 'species new',
          addedPhotos: [],
        }
        const state = {
          _uiVisibleLocalRecords: [],
          allRemoteObs: [
            {
              inatId: 666,
              uuid: '123A',
              speciesGuess: 'species old',
              photos: [],
            },
          ],
          localQueueSummary: [
            {
              uuid: '123A',
              [constants.recordProcessingOutcomeFieldName]: 'waiting',
              [constants.recordTypeFieldName]: 'edit',
            },
          ],
        }
        const dispatchedStuff = {}
        await objectUnderTest.actions.saveEditAndScheduleUpdate(
          {
            state,
            getters: {
              successfulLocalQueueSummary: objectUnderTest.getters.successfulLocalQueueSummary(
                state,
              ),
              deletesWithErrorDbIds: objectUnderTest.getters.deletesWithErrorDbIds(
                state,
              ),
              localRecords: objectUnderTest.getters.localRecords(state),
            },
            dispatch: (actionName, theArg) =>
              (dispatchedStuff[actionName] = theArg),
          },
          {
            record,
            photoIdsToDelete: [],
            obsFieldIdsToDelete: [],
            isDraft: false,
          },
        )
        const result = dispatchedStuff.upsertQueuedAction
        expect(result).toEqual({
          newPhotos: [],
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          record: {
            inatId: 666,
            photos: [],
            speciesGuess: 'species new',
            uuid: '123A',
            wowMeta: {
              recordType: 'edit',
              [constants.recordProcessingOutcomeFieldName]: 'waiting',
              [constants.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
              [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            },
          },
        })
        expect(wowUpdatedAtToBeCloseToNow(result.record)).toBe(true)
      })

      it('should save an edit on a local-only record', async () => {
        const record = {
          uuid: '123A',
          speciesGuess: 'species new',
          addedPhotos: [],
        }
        obsStore.setItem('123A', {
          uuid: '123A',
          speciesGuess: 'species old',
          photos: [],
        })
        const state = {
          _uiVisibleLocalRecords: [{ uuid: '123A' }],
          allRemoteObs: [],
          localQueueSummary: [
            {
              uuid: '123A',
              [constants.recordProcessingOutcomeFieldName]: 'waiting',
              [constants.recordTypeFieldName]: 'new',
            },
          ],
        }
        const dispatchedStuff = {}
        await objectUnderTest.actions.saveEditAndScheduleUpdate(
          {
            state,
            getters: {
              successfulLocalQueueSummary: objectUnderTest.getters.successfulLocalQueueSummary(
                state,
              ),
              deletesWithErrorDbIds: objectUnderTest.getters.deletesWithErrorDbIds(
                state,
              ),
              localRecords: objectUnderTest.getters.localRecords(state),
            },
            dispatch: (actionName, theArg) =>
              (dispatchedStuff[actionName] = theArg),
          },
          {
            record,
            photoIdsToDelete: [],
            obsFieldIdsToDelete: [],
            isDraft: false,
          },
        )
        const result = dispatchedStuff.upsertQueuedAction
        expect(result).toEqual({
          newPhotos: [],
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          record: {
            photos: [],
            speciesGuess: 'species new',
            uuid: '123A',
            wowMeta: {
              recordType: 'new',
              [constants.recordProcessingOutcomeFieldName]: 'waiting',
              [constants.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
              [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            },
          },
        })
      })

      it(
        'should handle when queue summary is out-of-sync with the store; the ' +
          `record is now remote (we don't know that in Vuex) but we think it's local`,
        async () => {
          const record = {
            uuid: '123A',
            speciesGuess: 'species new',
            addedPhotos: [],
          }
          // no record in the store, it was deleted (by WOW in another browser
          // tab) but we haven't updated our local queue in this tab
          const state = {
            _uiVisibleLocalRecords: [{ uuid: '123A' }],
            localQueueSummary: [
              {
                // we think there's a record in the store
                uuid: '123A',
                [constants.recordProcessingOutcomeFieldName]: 'waiting',
                [constants.recordTypeFieldName]: 'new',
              },
            ],
            allRemoteObs: [],
          }
          const dispatchedStuff = {}
          expect(
            objectUnderTest.actions.saveEditAndScheduleUpdate(
              {
                state,
                getters: {
                  successfulLocalQueueSummary: objectUnderTest.getters.successfulLocalQueueSummary(
                    state,
                  ),
                  deletesWithErrorDbIds: objectUnderTest.getters.deletesWithErrorDbIds(
                    state,
                  ),
                  localRecords: objectUnderTest.getters.localRecords(state),
                },
                dispatch: (actionName, theArg) =>
                  (dispatchedStuff[actionName] = theArg),
              },
              {
                record,
                photoIdsToDelete: [],
                obsFieldIdsToDelete: [],
              },
            ),
          ).rejects.toThrow(`Failed to save edited record with UUID='123A'`)
        },
      )

      it('should save an edit to a remote record', async () => {
        const record = {
          uuid: '123A',
          speciesGuess: 'species new',
          addedPhotos: [],
        }
        const state = {
          _uiVisibleLocalRecords: [],
          allRemoteObs: [
            {
              inatId: 666,
              uuid: '123A',
              speciesGuess: 'species old',
              photos: [],
            },
          ],
          localQueueSummary: [],
        }
        const dispatchedStuff = {}
        await objectUnderTest.actions.saveEditAndScheduleUpdate(
          {
            state,
            getters: {
              successfulLocalQueueSummary: objectUnderTest.getters.successfulLocalQueueSummary(
                state,
              ),
              deletesWithErrorDbIds: objectUnderTest.getters.deletesWithErrorDbIds(
                state,
              ),
              localRecords: objectUnderTest.getters.localRecords(state),
            },
            dispatch: (actionName, theArg) =>
              (dispatchedStuff[actionName] = theArg),
          },
          {
            record,
            photoIdsToDelete: [],
            obsFieldIdsToDelete: [],
            isDraft: false,
          },
        )
        const result = dispatchedStuff.upsertQueuedAction
        expect(result).toEqual({
          newPhotos: [],
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          record: {
            inatId: 666,
            photos: [],
            speciesGuess: 'species new',
            uuid: '123A',
            wowMeta: {
              recordType: 'edit',
              [constants.recordProcessingOutcomeFieldName]: 'waiting',
              [constants.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
              [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            },
          },
        })
      })

      it('should save an edit of a remote record that adds a photo', async () => {
        const newPhoto = {
          file: new Blob([0xff, 0xd8], { type: 'image/jpeg' }),
          type: 'top',
        }
        const record = {
          uuid: '123A',
          speciesGuess: 'species blah',
          addedPhotos: [newPhoto],
        }
        const state = {
          _uiVisibleLocalRecords: [],
          allRemoteObs: [
            {
              inatId: 666,
              uuid: '123A',
              speciesGuess: 'species blah',
              photos: [],
            },
          ],
          localQueueSummary: [],
        }
        const dispatchedStuff = {}
        await objectUnderTest.actions.saveEditAndScheduleUpdate(
          {
            state,
            getters: {
              successfulLocalQueueSummary: objectUnderTest.getters.successfulLocalQueueSummary(
                state,
              ),
              deletesWithErrorDbIds: objectUnderTest.getters.deletesWithErrorDbIds(
                state,
              ),
              localRecords: objectUnderTest.getters.localRecords(state),
            },
            dispatch: (actionName, theArg) =>
              (dispatchedStuff[actionName] = theArg),
          },
          {
            record,
            photoIdsToDelete: [],
            obsFieldIdsToDelete: [],
            isDraft: false,
          },
        )
        const result = dispatchedStuff.upsertQueuedAction
        const expectedPhoto1 = {
          file: {
            data: expect.any(ArrayBuffer),
            mime: 'image/jpeg',
          },
          id: -1,
          type: 'top',
          url: '(set at render time)',
        }
        expect(result).toEqual({
          photoIdsToDelete: [],
          newPhotos: [expectedPhoto1],
          obsFieldIdsToDelete: [],
          record: {
            inatId: 666,
            photos: [expectedPhoto1],
            speciesGuess: 'species blah',
            uuid: '123A',
            wowMeta: {
              recordType: 'edit',
              [constants.recordProcessingOutcomeFieldName]: 'waiting',
              [constants.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
              [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            },
          },
        })
      })

      it('should not duplicate photos when saving an edit of a local-only obs', async () => {
        const existingLocalPhoto = { id: -1, tag: 'photo1 placeholder' }
        obsStore.setItem('123A', {
          uuid: '123A',
          speciesGuess: 'species blah',
          photos: [existingLocalPhoto],
          wowMeta: {
            [constants.photosToAddFieldName]: [existingLocalPhoto],
          },
        })
        const newPhoto = {
          file: new Blob([0xff, 0xd8], { type: 'image/jpeg' }),
          type: 'top',
        }
        const existingRemotePhoto = {
          id: 888,
          isRemote: true,
          url: 'http://whatever...',
        }
        const record = {
          uuid: '123A',
          inatId: 666,
          speciesGuess: 'species blah',
          addedPhotos: [newPhoto],
        }
        const state = {
          _uiVisibleLocalRecords: [{ uuid: '123A' }],
          allRemoteObs: [
            {
              inatId: 666,
              uuid: '123A',
              speciesGuess: 'species blah',
              photos: [existingRemotePhoto],
            },
          ],
          localQueueSummary: [
            {
              uuid: '123A',
              [constants.recordProcessingOutcomeFieldName]: 'waiting',
              [constants.recordTypeFieldName]: 'new',
            },
          ],
        }
        const dispatchedStuff = {}
        await objectUnderTest.actions.saveEditAndScheduleUpdate(
          {
            state,
            getters: {
              localRecords: objectUnderTest.getters.localRecords(state),
            },
            dispatch: (actionName, theArg) =>
              (dispatchedStuff[actionName] = theArg),
          },
          {
            record,
            photoIdsToDelete: [],
            obsFieldIdsToDelete: [],
            isDraft: false,
          },
        )
        const expectedExistingLocalPhoto = { id: -2, tag: 'photo1 placeholder' }
        const result = dispatchedStuff.upsertQueuedAction
        const expectedNewPhoto = {
          file: {
            data: expect.any(ArrayBuffer),
            mime: 'image/jpeg',
          },
          id: -3,
          type: 'top',
          url: '(set at render time)',
        }
        expect(result.record.photos).toHaveLength(3)
        expect(result.newPhotos).toHaveLength(1)
        expect(result).toEqual({
          photoIdsToDelete: [],
          // we only need to add the new photo to be uploaded, not the existing
          // one that's already set to be uploaded too.
          newPhotos: [expectedNewPhoto],
          obsFieldIdsToDelete: [],
          record: {
            inatId: 666,
            photos: [
              // all photos should be here for UI
              {
                id: 888,
                isRemote: true,
                url: 'http://whatever...',
              },
              expectedExistingLocalPhoto,
              expectedNewPhoto,
            ],
            speciesGuess: 'species blah',
            uuid: '123A',
            wowMeta: {
              recordType: 'edit',
              [constants.recordProcessingOutcomeFieldName]: 'waiting',
              [constants.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
              [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            },
          },
        })
      })

      it('should save an edit that deletes a (remote) photo', async () => {
        const record = {
          uuid: '123A',
          speciesGuess: 'species blah',
          addedPhotos: [],
        }
        const state = {
          _uiVisibleLocalRecords: [],
          allRemoteObs: [
            {
              inatId: 666,
              uuid: '123A',
              speciesGuess: 'species blah',
              photos: [
                {
                  url: 'https://blah...',
                  uuid: 'dc813734-7182-46a5-a58a-7cb2d81cea4f',
                  id: 841,
                  isRemote: true,
                },
              ],
            },
          ],
          localQueueSummary: [
            {
              uuid: '123A',
              [constants.recordProcessingOutcomeFieldName]: 'waiting',
              [constants.recordTypeFieldName]: 'new',
            },
          ],
        }
        const dispatchedStuff = {}
        await objectUnderTest.actions.saveEditAndScheduleUpdate(
          {
            state,
            getters: {
              successfulLocalQueueSummary: objectUnderTest.getters.successfulLocalQueueSummary(
                state,
              ),
              deletesWithErrorDbIds: objectUnderTest.getters.deletesWithErrorDbIds(
                state,
              ),
              localRecords: objectUnderTest.getters.localRecords(state),
            },
            dispatch: (actionName, theArg) =>
              (dispatchedStuff[actionName] = theArg),
          },
          {
            record,
            photoIdsToDelete: [841],
            obsFieldIdsToDelete: [],
            isDraft: true,
          },
        )
        const result = dispatchedStuff.upsertQueuedAction
        expect(result).toEqual({
          photoIdsToDelete: [841],
          newPhotos: [],
          obsFieldIdsToDelete: [],
          record: {
            inatId: 666,
            photos: [],
            speciesGuess: 'species blah',
            uuid: '123A',
            wowMeta: {
              recordType: 'edit',
              [constants.recordProcessingOutcomeFieldName]: 'draft',
              [constants.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
              [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            },
          },
        })
      })

      it('should save an edit that deletes an obs field', async () => {
        const record = {
          uuid: '123A',
          speciesGuess: 'species blah',
          addedPhotos: [],
        }
        const state = {
          _uiVisibleLocalRecords: [],
          allRemoteObs: [
            {
              inatId: 666,
              uuid: '123A',
              speciesGuess: 'species blah',
              photos: [],
              obsFieldValues: {
                relationshipId: 32423,
                fieldId: 1,
                datatype: 'text',
                name: 'Orchid type',
                value: 'Lithophyte',
              },
            },
          ],
          localQueueSummary: [
            {
              uuid: '123A',
              [constants.recordProcessingOutcomeFieldName]: 'waiting',
              [constants.recordTypeFieldName]: 'new',
            },
          ],
        }
        const dispatchedStuff = {}
        await objectUnderTest.actions.saveEditAndScheduleUpdate(
          {
            state,
            getters: {
              successfulLocalQueueSummary: objectUnderTest.getters.successfulLocalQueueSummary(
                state,
              ),
              deletesWithErrorDbIds: objectUnderTest.getters.deletesWithErrorDbIds(
                state,
              ),
              localRecords: objectUnderTest.getters.localRecords(state),
            },
            dispatch: (actionName, theArg) =>
              (dispatchedStuff[actionName] = theArg),
          },
          {
            record,
            photoIdsToDelete: [],
            obsFieldIdsToDelete: [32423],
            isDraft: false,
          },
        )
        const result = dispatchedStuff.upsertQueuedAction
        expect(result).toEqual({
          obsFieldIdsToDelete: [32423],
          photoIdsToDelete: [],
          newPhotos: [],
          record: {
            inatId: 666,
            photos: [],
            speciesGuess: 'species blah',
            uuid: '123A',
            wowMeta: {
              recordType: 'edit',
              [constants.recordProcessingOutcomeFieldName]: 'waiting',
              [constants.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
              [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            },
          },
        })
      })

      it('should handle editing a blocked action without adding a photo', async () => {
        const existingLocalPhoto = { id: -1, tag: 'photo1 placeholder' }
        const existingBlockedLocalPhoto = { id: -2, tag: 'photo2 placeholder' }
        obsStore.setItem('123A', {
          uuid: '123A',
          speciesGuess: 'species blah',
          photos: [existingLocalPhoto],
          wowMeta: {
            [constants.photosToAddFieldName]: [existingLocalPhoto],
            [constants.blockedActionFieldName]: {
              wowMeta: {
                recordType: 'edit',
                [constants.photosToAddFieldName]: [existingBlockedLocalPhoto],
              },
            },
          },
        })
        const record = {
          uuid: '123A',
          inatId: 666,
          addedPhotos: [], // not adding new photos in this save
        }
        const state = {
          _uiVisibleLocalRecords: [{ uuid: '123A' }],
          allRemoteObs: [
            {
              inatId: record.inatId,
              uuid: record.uuid,
              photos: [
                {
                  id: 888,
                  isRemote: true,
                  url: 'http://whatever...',
                },
              ],
            },
          ],
          localQueueSummary: [
            {
              uuid: record.uuid,
              [constants.recordProcessingOutcomeFieldName]: 'systemError',
              [constants.recordTypeFieldName]: 'edit',
              [constants.hasBlockedActionFieldName]: true,
            },
          ],
        }
        const dispatchedStuff = {}
        await objectUnderTest.actions.saveEditAndScheduleUpdate(
          {
            state,
            getters: {
              localRecords: objectUnderTest.getters.localRecords(state),
            },
            dispatch: (actionName, theArg) =>
              (dispatchedStuff[actionName] = theArg),
          },
          {
            record,
            photoIdsToDelete: [],
            obsFieldIdsToDelete: [],
            isDraft: false,
          },
        )
        const result = dispatchedStuff.upsertBlockedAction
        expect(result.newPhotos).toHaveLength(0)
        expect(result.record.photos).toHaveLength(3)
        expect(result).toEqual({
          photoIdsToDelete: [],
          newPhotos: [],
          obsFieldIdsToDelete: [],
          record: {
            inatId: 666,
            photos: [
              {
                id: 888,
                isRemote: true,
                url: 'http://whatever...',
              },
              {
                tag: 'photo1 placeholder', // existing local photo
                id: -2,
              },
              {
                tag: 'photo2 placeholder', // existing local blocked photo
                id: -3,
              },
            ],
            speciesGuess: 'species blah',
            uuid: '123A',
            wowMeta: {
              [constants.recordTypeFieldName]: 'edit',
              // the edit resets the outcome to waiting
              [constants.recordProcessingOutcomeFieldName]: 'waiting',
              [constants.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
              [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            },
          },
        })
      })

      it('should handle editing a blocked action and adding a photo', async () => {
        const existingLocalPhoto = { id: -1, tag: 'photo1 placeholder' }
        const existingBlockedLocalPhoto = { id: -2, tag: 'photo2 placeholder' }
        obsStore.setItem('123A', {
          uuid: '123A',
          speciesGuess: 'species blah',
          photos: [existingLocalPhoto],
          wowMeta: {
            [constants.photosToAddFieldName]: [existingLocalPhoto],
            [constants.blockedActionFieldName]: {
              wowMeta: {
                recordType: 'edit',
                [constants.photosToAddFieldName]: [existingBlockedLocalPhoto],
              },
            },
          },
        })
        const record = {
          uuid: '123A',
          inatId: 667,
          addedPhotos: [
            {
              file: new Blob([0xff, 0xd8], { type: 'image/jpeg' }),
              type: 'top',
            },
          ],
        }
        const state = {
          _uiVisibleLocalRecords: [{ uuid: '123A' }],
          allRemoteObs: [
            {
              inatId: record.inatId,
              uuid: record.uuid,
              photos: [
                {
                  id: 888,
                  isRemote: true,
                  url: 'http://whatever...',
                },
              ],
            },
          ],
          localQueueSummary: [
            {
              uuid: record.uuid,
              [constants.recordProcessingOutcomeFieldName]: 'withServiceWorker',
              [constants.recordTypeFieldName]: 'edit',
              [constants.hasBlockedActionFieldName]: true,
            },
          ],
        }
        const dispatchedStuff = {}
        await objectUnderTest.actions.saveEditAndScheduleUpdate(
          {
            state,
            getters: {
              localRecords: objectUnderTest.getters.localRecords(state),
            },
            dispatch: (actionName, theArg) =>
              (dispatchedStuff[actionName] = theArg),
          },
          {
            record,
            photoIdsToDelete: [],
            obsFieldIdsToDelete: [],
            isDraft: false,
          },
        )
        const result = dispatchedStuff.upsertBlockedAction
        const expectedPhoto1 = {
          file: {
            data: expect.any(ArrayBuffer),
            mime: 'image/jpeg',
          },
          id: -4,
          type: 'top',
          url: '(set at render time)',
        }
        expect(result.newPhotos).toHaveLength(1)
        expect(result.record.photos).toHaveLength(4)
        expect(result).toEqual({
          photoIdsToDelete: [],
          newPhotos: [expectedPhoto1],
          obsFieldIdsToDelete: [],
          record: {
            inatId: 667,
            photos: [
              {
                id: 888,
                isRemote: true,
                url: 'http://whatever...',
              },
              {
                tag: 'photo1 placeholder', // existing local photo
                id: -2,
              },
              {
                tag: 'photo2 placeholder', // existing local blocked photo
                id: -3,
              },
              expectedPhoto1,
            ],
            speciesGuess: 'species blah',
            uuid: '123A',
            wowMeta: {
              [constants.recordTypeFieldName]: 'edit',
              [constants.recordProcessingOutcomeFieldName]: 'waiting',
              [constants.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
              [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            },
          },
        })
      })

      it('should handle editing a blocked action with a draft', async () => {
        obsStore.setItem('123A', {
          uuid: '123A',
          photos: [],
          wowMeta: {
            [constants.photosToAddFieldName]: [],
            [constants.blockedActionFieldName]: {
              wowMeta: {
                recordType: 'edit',
                [constants.photosToAddFieldName]: [],
              },
            },
          },
        })
        const record = {
          uuid: '123A',
          inatId: 668,
          addedPhotos: [],
        }
        const state = {
          _uiVisibleLocalRecords: [{ uuid: '123A' }],
          allRemoteObs: [
            {
              inatId: record.inatId,
              uuid: record.uuid,
              photos: [],
            },
          ],
          localQueueSummary: [
            {
              uuid: record.uuid,
              [constants.recordProcessingOutcomeFieldName]: 'withServiceWorker',
              [constants.recordTypeFieldName]: 'edit',
              [constants.hasBlockedActionFieldName]: true,
            },
          ],
        }
        const dispatchedStuff = {}
        await objectUnderTest.actions.saveEditAndScheduleUpdate(
          {
            state,
            getters: {
              localRecords: objectUnderTest.getters.localRecords(state),
            },
            dispatch: (actionName, theArg) =>
              (dispatchedStuff[actionName] = theArg),
          },
          {
            record,
            photoIdsToDelete: [],
            obsFieldIdsToDelete: [],
            isDraft: true,
          },
        )
        const result = dispatchedStuff.upsertBlockedAction
        expect(result).toEqual({
          photoIdsToDelete: [],
          newPhotos: [],
          obsFieldIdsToDelete: [],
          record: {
            inatId: 668,
            photos: [],
            uuid: '123A',
            wowMeta: {
              [constants.recordTypeFieldName]: 'edit',
              [constants.recordProcessingOutcomeFieldName]: 'draft',
              [constants.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
              [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            },
          },
        })
      })

      it('should handle editing a blocked action and deleting a photo', async () => {
        obsStore.setItem('123A', {
          uuid: '123A',
          photos: [],
          wowMeta: {
            [constants.photosToAddFieldName]: [],
            [constants.blockedActionFieldName]: {
              wowMeta: {
                recordType: 'edit',
                [constants.photosToAddFieldName]: [],
              },
            },
          },
        })
        const record = {
          uuid: '123A',
          inatId: 667,
          addedPhotos: [],
        }
        const state = {
          _uiVisibleLocalRecords: [{ uuid: '123A' }],
          allRemoteObs: [
            {
              inatId: record.inatId,
              uuid: record.uuid,
              photos: [
                {
                  id: 888,
                  isRemote: true,
                  url: 'http://whatever...',
                },
              ],
            },
          ],
          localQueueSummary: [
            {
              uuid: record.uuid,
              [constants.recordProcessingOutcomeFieldName]: 'withServiceWorker',
              [constants.recordTypeFieldName]: 'edit',
              [constants.hasBlockedActionFieldName]: true,
            },
          ],
        }
        const dispatchedStuff = {}
        await objectUnderTest.actions.saveEditAndScheduleUpdate(
          {
            state,
            getters: {
              localRecords: objectUnderTest.getters.localRecords(state),
            },
            dispatch: (actionName, theArg) =>
              (dispatchedStuff[actionName] = theArg),
          },
          {
            record,
            photoIdsToDelete: [888],
            obsFieldIdsToDelete: [],
            isDraft: false,
          },
        )
        const result = dispatchedStuff.upsertBlockedAction
        expect(result.record.photos).toHaveLength(0)
        expect(result).toEqual({
          photoIdsToDelete: [888],
          newPhotos: [],
          obsFieldIdsToDelete: [],
          record: {
            inatId: 667,
            photos: [],
            uuid: '123A',
            wowMeta: {
              [constants.recordTypeFieldName]: 'edit',
              [constants.recordProcessingOutcomeFieldName]: 'waiting',
              [constants.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
              [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            },
          },
        })
      })

      it('should handle editing a blocked action that has a pending photo delete', async () => {
        obsStore.setItem('123A', {
          uuid: '123A',
          photos: [],
          wowMeta: {
            [constants.photosToAddFieldName]: [],
            [constants.blockedActionFieldName]: {
              wowMeta: {
                recordType: 'edit',
                [constants.photosToAddFieldName]: [],
                [constants.photoIdsToDeleteFieldName]: [888],
              },
            },
          },
        })
        const record = {
          uuid: '123A',
          inatId: 667,
          addedPhotos: [],
        }
        const state = {
          _uiVisibleLocalRecords: [{ uuid: '123A' }],
          allRemoteObs: [
            {
              inatId: record.inatId,
              uuid: record.uuid,
              photos: [
                {
                  id: 888,
                  isRemote: true,
                  url: 'http://whatever...',
                },
              ],
            },
          ],
          localQueueSummary: [
            {
              uuid: record.uuid,
              [constants.recordProcessingOutcomeFieldName]: 'withServiceWorker',
              [constants.recordTypeFieldName]: 'edit',
              [constants.hasBlockedActionFieldName]: true,
            },
          ],
        }
        const dispatchedStuff = {}
        await objectUnderTest.actions.saveEditAndScheduleUpdate(
          {
            state,
            getters: {
              localRecords: objectUnderTest.getters.localRecords(state),
            },
            dispatch: (actionName, theArg) =>
              (dispatchedStuff[actionName] = theArg),
          },
          {
            record,
            photoIdsToDelete: [],
            obsFieldIdsToDelete: [],
            isDraft: false,
          },
        )
        const result = dispatchedStuff.upsertBlockedAction
        expect(result.record.photos).toHaveLength(0)
        expect(result).toEqual({
          photoIdsToDelete: [],
          newPhotos: [],
          obsFieldIdsToDelete: [],
          record: {
            inatId: 667,
            photos: [], // remote photo should still be deleted as per blocked action
            uuid: '123A',
            wowMeta: {
              [constants.recordTypeFieldName]: 'edit',
              [constants.recordProcessingOutcomeFieldName]: 'waiting',
              [constants.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
              [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            },
          },
        })
      })

      it('should handle a two edits, that both delete a photo', async () => {
        obsStore.setItem('123A', {
          uuid: '123A',
          photos: [{ id: 889 }],
          wowMeta: {
            [constants.photosToAddFieldName]: [],
            [constants.photoIdsToDeleteFieldName]: [888],
          },
        })
        const record = {
          uuid: '123A',
          inatId: 667,
          addedPhotos: [],
        }
        const state = {
          _uiVisibleLocalRecords: [{ uuid: '123A' }],
          allRemoteObs: [
            {
              inatId: record.inatId,
              uuid: record.uuid,
              photos: [
                {
                  id: 888,
                  isRemote: true,
                  url: 'http://whatever...',
                },
                {
                  id: 889,
                  isRemote: true,
                  url: 'http://whatever...',
                },
              ],
            },
          ],
          localQueueSummary: [
            {
              uuid: record.uuid,
              [constants.recordProcessingOutcomeFieldName]: 'waiting',
              [constants.recordTypeFieldName]: 'edit',
              [constants.hasBlockedActionFieldName]: false,
            },
          ],
        }
        const dispatchedStuff = {}
        await objectUnderTest.actions.saveEditAndScheduleUpdate(
          {
            state,
            getters: {
              localRecords: objectUnderTest.getters.localRecords(state),
            },
            dispatch: (actionName, theArg) =>
              (dispatchedStuff[actionName] = theArg),
          },
          {
            record,
            photoIdsToDelete: [889],
            obsFieldIdsToDelete: [],
            isDraft: false,
          },
        )
        const result = dispatchedStuff.upsertQueuedAction
        expect(result.record.photos).toHaveLength(0)
        expect(result).toEqual({
          photoIdsToDelete: [889],
          newPhotos: [],
          obsFieldIdsToDelete: [],
          record: {
            inatId: 667,
            photos: [], // second remote photo should be deleted
            uuid: '123A',
            wowMeta: {
              [constants.recordTypeFieldName]: 'edit',
              [constants.recordProcessingOutcomeFieldName]: 'waiting',
              [constants.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
              [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            },
          },
        })
      })
    })

    describe('edit strategies', () => {
      describe('upsertQueuedAction', () => {
        it('should create the record when none exists', async () => {
          const record = {
            uuid: '123A',
            testRecord: true,
            wowMeta: {
              [constants.recordProcessingOutcomeFieldName]:
                'the-supplied-outcome',
            },
          }
          await objectUnderTest.actions.upsertQueuedAction(null, { record })
          const result = await obsStore.getItem('123A')
          expect(result.testRecord).toBeTruthy()
          expect(
            result.wowMeta[constants.recordProcessingOutcomeFieldName],
          ).toEqual('the-supplied-outcome')
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

        it('should merge photoIdsToDelete with the existing', async () => {
          const record = {
            uuid: '123A',
            wowMeta: {
              [constants.photoIdsToDeleteFieldName]: [11, 22, 33],
            },
          }
          await obsStore.setItem('123A', record)
          const newPhotoIdsToDelete = [44]
          await objectUnderTest.actions.upsertQueuedAction(null, {
            record,
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

        it('should set photoIdsToDelete when none are already tagged for deletion', async () => {
          const record = {
            uuid: '123A',
            wowMeta: {
              [constants.photoIdsToDeleteFieldName]: null,
            },
          }
          await obsStore.setItem('123A', record)
          const newPhotoIdsToDelete = [44]
          await objectUnderTest.actions.upsertQueuedAction(null, {
            record,
            photoIdsToDelete: newPhotoIdsToDelete,
          })
          const result = await obsStore.getItem('123A')
          expect(result.wowMeta[constants.photoIdsToDeleteFieldName]).toEqual([
            44,
          ])
        })

        it('should set newPhotos when none are already pending', async () => {
          const record = {
            uuid: '123A',
            wowMeta: {
              [constants.photosToAddFieldName]: null,
            },
          }
          await obsStore.setItem('123A', record)
          const newPhotos = [{ testTag: 'photo 1' }]
          await objectUnderTest.actions.upsertQueuedAction(null, {
            record,
            newPhotos,
          })
          const result = await obsStore.getItem('123A')
          expect(result.wowMeta[constants.photosToAddFieldName]).toEqual([
            { testTag: 'photo 1' },
          ])
        })

        it('should merge newPhotos when some are already pending', async () => {
          const record = {
            uuid: '123A',
            wowMeta: {
              [constants.photosToAddFieldName]: [{ testTag: 'photo 1' }],
            },
          }
          await obsStore.setItem('123A', record)
          const newPhotos = [{ testTag: 'photo 2' }]
          await objectUnderTest.actions.upsertQueuedAction(null, {
            record,
            newPhotos,
          })
          const result = await obsStore.getItem('123A')
          expect(result.wowMeta[constants.photosToAddFieldName]).toEqual([
            { testTag: 'photo 1' },
            { testTag: 'photo 2' },
          ])
        })

        it('should merge obsFieldIdsToDelete with the existing', async () => {
          const record = {
            uuid: '123A',
            wowMeta: {
              [constants.obsFieldIdsToDeleteFieldName]: [11, 22, 33],
            },
          }
          await obsStore.setItem('123A', record)
          const newObsFieldIdsToDelete = [44]
          await objectUnderTest.actions.upsertQueuedAction(null, {
            record,
            obsFieldIdsToDelete: newObsFieldIdsToDelete,
          })
          const result = await obsStore.getItem('123A')
          expect(
            result.wowMeta[constants.obsFieldIdsToDeleteFieldName],
          ).toEqual([11, 22, 33, 44])
        })
      })

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
          await objectUnderTest.actions.upsertBlockedAction(null, {
            record,
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
          'should only merge the photosIdsToDelete with the existing ' +
            'blocked action, but leave the record wowMeta values alone',
          async () => {
            await obsStore.setItem('123A', {
              uuid: '123A',
              wowMeta: {
                [constants.recordTypeFieldName]: 'new',
                [constants.photoIdsToDeleteFieldName]: [21, 22],
                [constants.blockedActionFieldName]: {
                  wowMeta: {
                    [constants.photoIdsToDeleteFieldName]: [23, 24],
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
            await objectUnderTest.actions.upsertBlockedAction(null, {
              record,
              photoIdsToDelete: newPhotoIdsToDelete,
            })
            const result = await obsStore.getItem('123A')
            expect(
              result.wowMeta[constants.photoIdsToDeleteFieldName],
            ).toEqual([21, 22])
            expect(
              result.wowMeta[constants.blockedActionFieldName].wowMeta[
                constants.photoIdsToDeleteFieldName
              ],
            ).toEqual([23, 24, 25, 26])
          },
        )

        it('should not duplicate added photos when editing a blocked action', async () => {
          await obsStore.setItem('123A', {
            uuid: '123A',
            wowMeta: {
              [constants.recordTypeFieldName]: 'new',
              [constants.photosToAddFieldName]: ['photo1 placeholder'],
              [constants.blockedActionFieldName]: {
                wowMeta: {
                  [constants.photosToAddFieldName]: ['photo2 placeholder'],
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
          const newPhotos = []
          await objectUnderTest.actions.upsertBlockedAction(null, {
            record,
            newPhotos,
          })
          const result = await obsStore.getItem('123A')
          expect(result.wowMeta[constants.photosToAddFieldName]).toEqual([
            'photo1 placeholder',
          ])
          expect(
            result.wowMeta[constants.blockedActionFieldName].wowMeta[
              constants.photosToAddFieldName
            ],
          ).toEqual(['photo2 placeholder'])
        })

        it(
          'should only merge the newPhotos with the existing ' +
            'blocked action, but leave the record wowMeta values alone',
          async () => {
            await obsStore.setItem('123A', {
              uuid: '123A',
              wowMeta: {
                [constants.recordTypeFieldName]: 'new',
                [constants.photosToAddFieldName]: ['photo1 placeholder'],
                [constants.blockedActionFieldName]: {
                  wowMeta: {
                    [constants.photosToAddFieldName]: ['photo2 placeholder'],
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
            const newPhotos = ['photo3 placeholder']
            await objectUnderTest.actions.upsertBlockedAction(null, {
              record,
              newPhotos,
            })
            const result = await obsStore.getItem('123A')
            expect(result.wowMeta[constants.photosToAddFieldName]).toEqual([
              'photo1 placeholder',
            ])
            expect(
              result.wowMeta[constants.blockedActionFieldName].wowMeta[
                constants.photosToAddFieldName
              ],
            ).toEqual(['photo2 placeholder', 'photo3 placeholder'])
          },
        )

        it(
          'should only merge the obsFieldsIdsToDelete with the existing ' +
            'blocked action, but leave the record wowMeta values alone',
          async () => {
            await obsStore.setItem('123A', {
              uuid: '123A',
              wowMeta: {
                [constants.recordTypeFieldName]: 'new',
                [constants.obsFieldIdsToDeleteFieldName]: [31, 32],
                [constants.blockedActionFieldName]: {
                  wowMeta: {
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
            const newObsFieldIdsToDelete = [35, 36]
            await objectUnderTest.actions.upsertBlockedAction(null, {
              record,
              obsFieldIdsToDelete: newObsFieldIdsToDelete,
            })
            const result = await obsStore.getItem('123A')
            expect(
              result.wowMeta[constants.obsFieldIdsToDeleteFieldName],
            ).toEqual([31, 32])
            expect(
              result.wowMeta[constants.blockedActionFieldName].wowMeta[
                constants.obsFieldIdsToDeleteFieldName
              ],
            ).toEqual([33, 34, 35, 36])
          },
        )

        it(
          'should keep the values from the passed record.wowMeta,' +
            ' like wowUpdatedAt',
          async () => {
            await obsStore.setItem('123A', {
              uuid: '123A',
              wowMeta: {
                [constants.recordTypeFieldName]: 'new',
              },
            })
            const record = {
              uuid: '123A',
              wowMeta: {
                [constants.recordTypeFieldName]: 'edit',
                wowUpdatedAt: 'some time string',
              },
            }
            await objectUnderTest.actions.upsertBlockedAction(null, {
              record,
            })
            const result = await obsStore.getItem('123A')
            expect(result.wowMeta.wowUpdatedAt).toBeUndefined()
            expect(
              result.wowMeta[constants.blockedActionFieldName].wowMeta
                .wowUpdatedAt,
            ).toEqual('some time string')
          },
        )
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
            [constants.blockedActionFieldName]: {
              wowMeta: {
                [constants.recordProcessingOutcomeFieldName]: 'test-outcome',
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
            [constants.recordProcessingOutcomeFieldName]: 'test-outcome',
            allBlockedObjFields: 'yep',
            [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
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
    const obsStore = getOrCreateInstance('wow-obs')

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
          [constants.recordTypeFieldName]: 'new',
          [constants.recordProcessingOutcomeFieldName]: 'waiting',
          [constants.photosToAddFieldName]: [],
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
            [constants.photosToAddFieldName]: [],
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

  describe('deleteSelectedRecord', () => {
    const obsStore = getOrCreateInstance('wow-obs')

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
            [constants.recordProcessingOutcomeFieldName]: 'waiting',
            [constants.recordTypeFieldName]: 'new',
            [constants.photosToAddFieldName]: [],
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
            [constants.recordTypeFieldName]: 'new',
            [constants.recordProcessingOutcomeFieldName]: 'withServiceWorker',
            [constants.photosToAddFieldName]: [],
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
        expect(result.wowMeta[constants.blockedActionFieldName]).toEqual({
          wowMeta: {
            [constants.recordTypeFieldName]: 'delete',
            [constants.recordProcessingOutcomeFieldName]: 'waiting',
            [constants.photoIdsToDeleteFieldName]: [],
            [constants.photosToAddFieldName]: [],
            [constants.obsFieldIdsToDeleteFieldName]: [],
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
          [constants.photosToAddFieldName]: [],
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
          [constants.recordTypeFieldName]: 'delete',
          [constants.recordProcessingOutcomeFieldName]: 'waiting',
          [constants.photoIdsToDeleteFieldName]: [],
          [constants.photosToAddFieldName]: [],
          [constants.obsFieldIdsToDeleteFieldName]: [],
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
            [constants.recordProcessingOutcomeFieldName]: 'waiting',
            [constants.recordTypeFieldName]: 'edit',
            [constants.photoIdsToDeleteFieldName]: [
              'this should get clobbered',
            ],
            [constants.photosToAddFieldName]: [],
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
            [constants.recordTypeFieldName]: 'delete',
            [constants.recordProcessingOutcomeFieldName]: 'waiting',
            [constants.photoIdsToDeleteFieldName]: [],
            [constants.photosToAddFieldName]: [],
            [constants.obsFieldIdsToDeleteFieldName]: [],
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
            [constants.recordProcessingOutcomeFieldName]: 'withServiceWorker',
            [constants.recordTypeFieldName]: 'edit',
            [constants.photosToAddFieldName]: [],
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
        expect(result.wowMeta[constants.recordTypeFieldName]).toEqual('edit')
        expect(result.wowMeta[constants.blockedActionFieldName]).toEqual({
          wowMeta: {
            [constants.recordTypeFieldName]: 'delete',
            [constants.recordProcessingOutcomeFieldName]: 'waiting',
            [constants.photoIdsToDeleteFieldName]: [],
            [constants.photosToAddFieldName]: [],
            [constants.obsFieldIdsToDeleteFieldName]: [],
          },
        })
        expect(capturedCommits.setSelectedObservationUuid).toBeNull()
      },
    )
  })

  describe('deleteSelectedLocalRecord', () => {
    const obsStore = getOrCreateInstance('wow-obs')

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
          [constants.recordProcessingOutcomeFieldName]: 'waiting',
          [constants.recordTypeFieldName]: 'new',
          [constants.photosToAddFieldName]: [],
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

    it('should throw the expected error when we try to delete a non-existent ID', async () => {
      // obsStore is empty
      try {
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
      } catch (err) {
        expect(err.message).toEqual(
          expect.stringMatching(/^Failed to delete local record/),
        )
        return
      }
      throw new Error('Expected error should have been thrown')
    })
  })

  describe('cleanSuccessfulLocalRecordsRemoteHasEchoed', () => {
    const obsStore = getOrCreateInstance('wow-obs')

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
            [constants.recordProcessingOutcomeFieldName]: 'success',
            [constants.recordTypeFieldName]: 'new',
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
              [constants.recordProcessingOutcomeFieldName]: 'success',
              [constants.recordTypeFieldName]: 'edit',
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
              [constants.recordProcessingOutcomeFieldName]: 'success',
              [constants.recordTypeFieldName]: 'edit',
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
            [constants.recordProcessingOutcomeFieldName]: 'success',
            [constants.recordTypeFieldName]: 'delete',
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
            [constants.recordProcessingOutcomeFieldName]: 'systemError',
            [constants.recordTypeFieldName]: 'delete',
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
      await obsStore.setItem('456B', {
        uuid: '456B',
        photos: ['photo1 placeholder', 'photo2 placeholder'],
        wowMeta: {
          [constants.photosToAddFieldName]: ['photo1 placeholder'],
          [constants.blockedActionFieldName]: {
            wowMeta: {
              [constants.recordTypeFieldName]: 'edit',
              [constants.photoIdsToDeleteFieldName]: [111],
              [constants.recordProcessingOutcomeFieldName]: 'waiting',
              [constants.photosToAddFieldName]: ['photo2 placeholder'],
            },
          },
        },
      })
      const state = {
        allRemoteObs: [{ uuid: '456B', inatId: 987 }],
        localQueueSummary: [
          {
            uuid: '456B',
            [constants.recordProcessingOutcomeFieldName]: 'success',
            [constants.recordTypeFieldName]: 'new',
            [constants.hasBlockedActionFieldName]: true,
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
        [constants.recordTypeFieldName]: 'edit',
        [constants.recordProcessingOutcomeFieldName]: 'waiting',
        [constants.photoIdsToDeleteFieldName]: [111],
        [constants.photosToAddFieldName]: ['photo2 placeholder'],
        [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
      })
    })
  })

  describe('findDbIdForWowId', () => {
    const obsStore = getOrCreateInstance('wow-obs')

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
            [constants.recordProcessingOutcomeFieldName]:
              constants.waitingOutcome,
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
            [constants.recordProcessingOutcomeFieldName]:
              constants.withServiceWorkerOutcome,
          },
        ],
      }
      const result = await objectUnderTest.actions.getCurrentOutcomeForWowId(
        await buildDumbContext({ state }),
        111,
      )
      expect(result).toEqual('withServiceWorker')
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

describe('mapObsFromOurDomainOntoApi', () => {
  it('should map all the top level properties for a non-delete record', () => {
    const record = {
      uuid: '111A',
      speciesGuess: 'some species',
      description: 'some desc',
      captive_flag: false,
      lat: -35.123,
      lng: 138.123,
      geoprivacy: 'obscured',
      observedAt: '2020-01-03T05:18:10.702Z',
      positional_accuracy: 1234,
      photos: [],
      obsFieldValues: [],
      wowMeta: { recordType: 'new' },
    }
    const result = _testonly.mapObsFromOurDomainOntoApi(record)
    expect(result.photoPostBodyPartials).toEqual([])
    expect(result.observationPostBody).toEqual({
      observation: {
        uuid: '111A',
        species_guess: 'some species',
        captive_flag: false,
        description: 'some desc',
        geoprivacy: 'obscured',
        latitude: -35.123,
        longitude: 138.123,
        observed_on_string: '2020-01-03T05:18:10.702Z',
        positional_accuracy: 1234,
        observation_field_values_attributes: {},
      },
    })
  })

  it('should map a delete record', () => {
    const record = {
      inatId: 544,
      uuid: 'd3635120-1669-11ea-bce5-695a028863dd',
      wowMeta: {
        recordType: 'delete',
        recordProcessingOutcome: 'waiting',
        [constants.photoIdsToDeleteFieldName]: [],
      },
    }
    const result = _testonly.mapObsFromOurDomainOntoApi(record)
    expect(result).toEqual({})
  })

  it('should map a record with photos to save', () => {
    const record = {
      uuid: '111A',
      speciesGuess: 'some species',
      lat: -35.123,
      lng: 138.123,
      observedAt: '2020-01-03T05:18:10.702Z',
      photos: [
        { testTag: 'ignore remote photos', isRemote: true },
        { testTag: 'some local photo' },
      ],
      obsFieldValues: [],
      wowMeta: {
        recordType: 'new',
        [constants.photosToAddFieldName]: [{ testTag: 'save me' }],
      },
    }
    const result = _testonly.mapObsFromOurDomainOntoApi(record)
    expect(result).toEqual({
      observationPostBody: {
        observation: {
          latitude: -35.123,
          longitude: 138.123,
          observed_on_string: '2020-01-03T05:18:10.702Z',
          species_guess: 'some species',
          uuid: '111A',
          observation_field_values_attributes: {},
        },
      },
      photoPostBodyPartials: [{ testTag: 'save me' }],
      totalTaskCount: 2,
    })
  })

  it('should map a record with obsFields to save', () => {
    const record = {
      uuid: '111A',
      speciesGuess: 'some species',
      lat: -35.123,
      lng: 138.123,
      observedAt: '2020-01-03T05:18:10.702Z',
      photos: [],
      obsFieldValues: [{ fieldId: 11, value: 'blah' }],
      wowMeta: { recordType: 'new' },
    }
    const result = _testonly.mapObsFromOurDomainOntoApi(record)
    expect(result).toEqual({
      observationPostBody: {
        observation: {
          latitude: -35.123,
          longitude: 138.123,
          observed_on_string: '2020-01-03T05:18:10.702Z',
          species_guess: 'some species',
          uuid: '111A',
          observation_field_values_attributes: {
            0: { observation_field_id: 11, value: 'blah' },
          },
        },
      },
      photoPostBodyPartials: [],
      totalTaskCount: 1,
    })
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

function wowUpdatedAtToBeCloseToNow(record) {
  const updatedAtStr = record.wowMeta.wowUpdatedAt
  if (!updatedAtStr) {
    return failReallyLoudly(`updateAtStr was falsy '${updatedAtStr}'`)
  }
  const updatedAtDate = dayjs(updatedAtStr)
  const fiveMinutesAgo = dayjs().subtract(5, 'minutes')
  const now = dayjs()
  if (updatedAtDate.isBefore(fiveMinutesAgo)) {
    return failReallyLoudly(
      `updatedAtDate='${updatedAtDate}' is before 5 minutes ago from now=${fiveMinutesAgo}`,
    )
  }
  if (updatedAtDate.isAfter(now)) {
    return failReallyLoudly(
      `updatedAtDate='${updatedAtDate}' is after now='${now}`,
    )
  }
  return true
  function failReallyLoudly(msg) {
    throw new Error(`AssertionFail: ${msg}`)
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

function getMinimalJpegBlob() {
  // thanks for the tiny JPEG https://github.com/mathiasbynens/small/blob/master/jpeg.jpg
  const tinyJpegBase64Enc =
    '/9j/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA' +
    '8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wA' +
    'BgAQEAX/2gAIAQEAAD8A0s8g/9k='
  // thanks for the conversion https://stackoverflow.com/a/16245768/1410035
  const byteCharacters = atob(tinyJpegBase64Enc)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: 'image/jpeg' })
}
