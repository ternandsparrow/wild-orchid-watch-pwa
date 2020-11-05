import dayjs from 'dayjs'
import { getOrCreateInstance } from '@/indexeddb/storage-manager'
import * as constants from '@/misc/constants'
import { _testonly } from '@/store/obs-store.worker'
import { _testonly as obsStoreCommonTestOnly } from '@/indexeddb/obs-store-common'
import {
  byteLengthOfThumbnail,
  getPhotoWithThumbnail,
  sizeOfPhotoWithExifThumbnail,
} from '@/../tests/unit/test-helpers'

const objectUnderTest = _testonly.exposed

describe('things that need a datastore', () => {
  let origConsoleDebug
  const obsStore = getOrCreateInstance(constants.lfWowObsStoreName)
  const photoStore = getOrCreateInstance(constants.lfWowPhotoStoreName)

  const originalFn = obsStoreCommonTestOnly.interceptableFns.storePhotoRecord
  function stubStorePhotoRecordFn() {
    // stub blob handling to avoid supplying full, valid Blobs for every test.
    obsStoreCommonTestOnly.interceptableFns.storePhotoRecord = async (_, r) => {
      await photoStore.setItem(r.id, r)
      return {
        ...r,
        thumb: true,
      }
    }
  }

  beforeAll(function() {
    stubStorePhotoRecordFn()
    origConsoleDebug = console.debug
    console.debug = () => {}
  })

  beforeEach(async () => {
    await obsStore.clear()
    await photoStore.clear()
  })

  afterAll(async () => {
    await obsStore.clear()
    await photoStore.clear()
    console.debug = origConsoleDebug
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
      await _testonly.upsertBlockedAction({
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
        await _testonly.upsertBlockedAction({
          record,
          photoIdsToDelete: newPhotoIdsToDelete,
        })
        const result = await obsStore.getItem('123A')
        expect(result.wowMeta[constants.photoIdsToDeleteFieldName]).toEqual([
          21,
          22,
        ])
        expect(
          result.wowMeta[constants.blockedActionFieldName].wowMeta[
            constants.photoIdsToDeleteFieldName
          ],
        ).toEqual([23, 24, 25, 26])
      },
    )

    it('should not duplicate added photos when editing a blocked action', async () => {
      const existingLocalPhoto = { id: '11', testTag: 'photo1 placeholder' }
      const existingBlockedPhoto = { id: '22', testTag: 'photo2 placeholder' }
      const baseRecord = {
        uuid: '123A',
        photos: [existingLocalPhoto, existingBlockedPhoto],
      }
      await obsStore.setItem('123A', {
        ...baseRecord,
        wowMeta: {
          [constants.recordTypeFieldName]: 'new',
          [constants.photosToAddFieldName]: [existingLocalPhoto],
          [constants.blockedActionFieldName]: {
            wowMeta: {
              [constants.photosToAddFieldName]: [existingBlockedPhoto],
            },
          },
        },
      })
      const record = {
        ...baseRecord,
        wowMeta: {
          [constants.recordTypeFieldName]: 'edit',
        },
      }
      const newPhotos = []
      await _testonly.upsertBlockedAction({
        record,
        newPhotos,
      })
      const result = await obsStore.getItem('123A')
      expect(result.wowMeta[constants.photosToAddFieldName]).toEqual([
        { id: '11', testTag: 'photo1 placeholder', thumb: true },
      ])
      expect(
        result.wowMeta[constants.blockedActionFieldName].wowMeta[
          constants.photosToAddFieldName
        ],
      ).toEqual([{ id: '22', testTag: 'photo2 placeholder', thumb: true }])
    })

    it(
      'should only merge the newPhotos with the existing ' +
        'blocked action, but leave the record wowMeta values alone',
      async () => {
        const existingLocalPhoto = { id: '11', testTag: 'photo1 placeholder' }
        const existingBlockedPhoto = { id: '22', testTag: 'photo2 placeholder' }
        const baseRecord = {
          uuid: '123A',
          photos: [existingLocalPhoto, existingBlockedPhoto],
        }
        await obsStore.setItem('123A', {
          ...baseRecord,
          wowMeta: {
            [constants.recordTypeFieldName]: 'new',
            [constants.photosToAddFieldName]: [existingLocalPhoto],
            [constants.blockedActionFieldName]: {
              wowMeta: {
                [constants.photosToAddFieldName]: [existingBlockedPhoto],
              },
            },
          },
        })
        const newPhoto = { id: '33', testTag: 'photo3 placeholder' }
        const record = {
          uuid: '123A',
          photos: [...baseRecord.photos, newPhoto],
          wowMeta: {
            [constants.recordTypeFieldName]: 'edit',
          },
        }
        const newPhotos = [newPhoto]
        await _testonly.upsertBlockedAction({
          record,
          newPhotos,
        })
        const result = await obsStore.getItem('123A')
        expect(result.wowMeta[constants.photosToAddFieldName]).toEqual([
          { id: '11', testTag: 'photo1 placeholder', thumb: true },
        ])
        expect(
          result.wowMeta[constants.blockedActionFieldName].wowMeta[
            constants.photosToAddFieldName
          ],
        ).toEqual([
          { id: '22', testTag: 'photo2 placeholder', thumb: true },
          { id: '33', testTag: 'photo3 placeholder', thumb: true },
        ])
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
        await _testonly.upsertBlockedAction({
          record,
          obsFieldIdsToDelete: newObsFieldIdsToDelete,
        })
        const result = await obsStore.getItem('123A')
        expect(result.wowMeta[constants.obsFieldIdsToDeleteFieldName]).toEqual([
          31,
          32,
        ])
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
        await _testonly.upsertBlockedAction({
          record,
        })
        const result = await obsStore.getItem('123A')
        expect(result.wowMeta.wowUpdatedAt).toBeUndefined()
        expect(
          result.wowMeta[constants.blockedActionFieldName].wowMeta.wowUpdatedAt,
        ).toEqual('some time string')
      },
    )
  })

  describe('upsertQueuedAction', () => {
    it('should create the record when none exists', async () => {
      const record = {
        uuid: '123A',
        testRecord: true,
        wowMeta: {
          [constants.recordProcessingOutcomeFieldName]: 'the-supplied-outcome',
        },
      }
      await _testonly.upsertQueuedAction({ record })
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
      await _testonly.upsertQueuedAction({ record })
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
      await _testonly.upsertQueuedAction({
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
      await _testonly.upsertQueuedAction({
        record,
        photoIdsToDelete: newPhotoIdsToDelete,
      })
      const result = await obsStore.getItem('123A')
      expect(result.wowMeta[constants.photoIdsToDeleteFieldName]).toEqual([44])
    })

    it('should set newPhotos when none are already pending', async () => {
      const newPhoto = { id: '11', testTag: 'photo 1' }
      const record = {
        uuid: '123A',
        photos: [newPhoto],
        wowMeta: {
          [constants.photosToAddFieldName]: null,
        },
      }
      await obsStore.setItem('123A', record)
      const newPhotos = [newPhoto]
      await _testonly.upsertQueuedAction({
        record,
        newPhotos,
      })
      const result = await obsStore.getItem('123A')
      expect(result.wowMeta[constants.photosToAddFieldName]).toEqual([
        { id: '11', testTag: 'photo 1', thumb: true },
      ])
    })

    it('should merge newPhotos when some are already pending', async () => {
      const existingPhoto = { id: '11', testTag: 'photo 1' }
      const newPhoto = { id: '22', testTag: 'photo 2' }
      const record = {
        uuid: '123A',
        photos: [existingPhoto, newPhoto],
        wowMeta: {
          [constants.photosToAddFieldName]: [existingPhoto],
        },
      }
      await obsStore.setItem('123A', record)
      const newPhotos = [newPhoto]
      await _testonly.upsertQueuedAction({
        record,
        newPhotos,
      })
      const result = await obsStore.getItem('123A')
      expect(result.wowMeta[constants.photosToAddFieldName]).toEqual([
        { id: '11', testTag: 'photo 1', thumb: true },
        { id: '22', testTag: 'photo 2', thumb: true },
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
      await _testonly.upsertQueuedAction({
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
  })

  describe('saveNewAndScheduleUpload', () => {
    it('should save a new record without photos', async () => {
      const record = {
        speciesGuess: 'species new',
        addedPhotos: [],
        observedAt: 1595491950028,
      }
      const newRecordId = await objectUnderTest.saveNewAndScheduleUpload({
        record,
        isDraft: true,
      })
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
          [constants.versionFieldName]: constants.currentRecordVersion,
        },
      })
    })

    it('should save a new record with photos', async () => {
      obsStoreCommonTestOnly.interceptableFns.storePhotoRecord = originalFn // undo stub
      const record = {
        speciesGuess: 'species new',
        addedPhotos: [
          {
            file: getPhotoWithThumbnail(),
            type: 'top',
          },
          {
            file: getPhotoWithThumbnail(),
            type: 'habitat',
          },
        ],
      }
      const newRecordId = await objectUnderTest.saveNewAndScheduleUpload({
        record,
        isDraft: false,
      })
      const result = await obsStore.getItem(newRecordId)
      const expectedPhoto1 = {
        file: {
          data: expect.any(ArrayBuffer),
          mime: 'image/jpeg',
        },
        id: expect.toBeUuidString(),
        type: 'top',
        url: '(set at render time)',
      }
      const expectedPhoto2 = {
        file: {
          data: expect.any(ArrayBuffer),
          mime: 'image/jpeg',
        },
        id: expect.toBeUuidString(),
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
          [constants.versionFieldName]: constants.currentRecordVersion,
        },
      })
      expect(result.photos[0].file.data.byteLength).toEqual(
        byteLengthOfThumbnail,
      )
      expect(result.photos[1].file.data.byteLength).toEqual(
        byteLengthOfThumbnail,
      )
      const resultPhoto1 = await photoStore.getItem(result.photos[0].id)
      expect(resultPhoto1).toEqual(expectedPhoto1)
      expect(resultPhoto1.file.data.byteLength).toEqual(
        sizeOfPhotoWithExifThumbnail,
      )
      const resultPhoto2 = await photoStore.getItem(result.photos[1].id)
      expect(resultPhoto2).toEqual(expectedPhoto2)
      expect(resultPhoto2.file.data.byteLength).toEqual(
        sizeOfPhotoWithExifThumbnail,
      )
      stubStorePhotoRecordFn()
    })
  })

  describe('saveEditAndScheduleUpdate', () => {
    it('should save an edit that changes the speciesGuess on an existing local edit', async () => {
      await obsStore.setItem('123A', {
        uuid: '123A',
        inatId: 666,
        speciesGuess: 'species old',
        photos: [],
      })
      const record = {
        uuid: '123A',
        speciesGuess: 'species new',
        addedPhotos: [],
      }
      let result
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
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
          localRecords: [{ uuid: '123A' }],
        },
        {
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
      )
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
        addedPhotos: [
          {
            file: new Blob([0xff, 0xd8], { type: 'image/jpeg' }),
            type: 'top',
          },
        ],
      }
      await obsStore.setItem('123A', {
        uuid: '123A',
        speciesGuess: 'species old',
        photos: ['photo1'],
        wowMeta: {
          [constants.photosToAddFieldName]: [{ id: -1, testTag: 'photo1' }],
        },
      })
      let result
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          allRemoteObs: [],
          localQueueSummary: [
            {
              uuid: '123A',
              [constants.recordProcessingOutcomeFieldName]: 'waiting',
              [constants.recordTypeFieldName]: 'new',
            },
          ],
          localRecords: [{ uuid: '123A' }],
        },
        {
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
      )
      const expectedPhoto = {
        file: expect.any(Blob),
        id: expect.toBeUuidString(),
        type: 'top',
        url: '(set at render time)',
      }
      expect(result).toEqual({
        newPhotos: [expectedPhoto],
        photoIdsToDelete: [],
        obsFieldIdsToDelete: [],
        record: {
          photos: [{ id: -1, testTag: 'photo1' }, expectedPhoto],
          speciesGuess: 'species new',
          uuid: '123A',
          wowMeta: {
            recordType: 'new',
            [constants.recordProcessingOutcomeFieldName]: 'waiting',
            [constants.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
            [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            [constants.photosToAddFieldName]: [{ id: -1, testTag: 'photo1' }],
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
        expect(
          objectUnderTest.saveEditAndScheduleUpdate(
            // no record in the store, it was deleted (by WOW in another browser
            // tab) but we haven't updated our local queue in this tab
            {
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
            },
            {
              record,
              photoIdsToDelete: [],
              obsFieldIdsToDelete: [],
            },
            stubRunStrategy,
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
      let result
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          localRecords: [],
          allRemoteObs: [
            {
              inatId: 666,
              uuid: '123A',
              speciesGuess: 'species old',
              photos: [],
            },
          ],
          localQueueSummary: [],
        },
        {
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
      )
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
      let result
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          localRecords: [],
          allRemoteObs: [
            {
              inatId: 666,
              uuid: '123A',
              speciesGuess: 'species blah',
              photos: [],
            },
          ],
          localQueueSummary: [],
        },
        {
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
      )
      const expectedPhoto1 = {
        file: expect.any(Blob),
        id: expect.toBeUuidString(),
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
      await obsStore.setItem('123A', {
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
      let result
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          localRecords: [{ uuid: '123A' }],
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
        },
        {
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
      )
      const expectedExistingLocalPhoto = { id: -2, tag: 'photo1 placeholder' }
      const expectedNewPhoto = {
        file: expect.any(Blob),
        id: expect.toBeUuidString(),
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
            [constants.photosToAddFieldName]: [expectedExistingLocalPhoto],
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
      let result
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          localRecords: [],
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
        },
        {
          record,
          photoIdsToDelete: [841],
          obsFieldIdsToDelete: [],
          isDraft: true,
        },
        (_, params) => (result = params),
      )
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
      let result
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          localRecords: [],
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
        },
        {
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [32423],
          isDraft: false,
        },
        (_, params) => (result = params),
      )
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
      await obsStore.setItem('123A', {
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
      let result
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          localRecords: [{ uuid: '123A' }],
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
        },
        {
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
      )
      expect(result.newPhotos).toHaveLength(0)
      expect(result.record.photos).toHaveLength(3)
      const expectedExistingLocalPhoto = {
        tag: 'photo1 placeholder', // existing local photo
        id: -2,
      }
      const expectedExistingBlockedPhoto = {
        tag: 'photo2 placeholder', // existing local blocked photo
        id: -3,
      }
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
            expectedExistingLocalPhoto,
            expectedExistingBlockedPhoto,
          ],
          speciesGuess: 'species blah',
          uuid: '123A',
          wowMeta: {
            [constants.recordTypeFieldName]: 'edit',
            // the edit resets the outcome to waiting
            [constants.recordProcessingOutcomeFieldName]: 'waiting',
            [constants.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
            [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            [constants.photosToAddFieldName]: [expectedExistingLocalPhoto],
            [constants.blockedActionFieldName]: {
              wowMeta: {
                recordType: 'edit',
                [constants.photosToAddFieldName]: [
                  expectedExistingBlockedPhoto,
                ],
              },
            },
          },
        },
      })
    })

    it('should handle editing a blocked action and adding a photo', async () => {
      const existingLocalPhoto = { id: -1, tag: 'photo1 placeholder' }
      const existingBlockedLocalPhoto = { id: -2, tag: 'photo2 placeholder' }
      await obsStore.setItem('123A', {
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
      let result
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          localRecords: [{ uuid: '123A' }],
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
        },
        {
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
      )
      const expectedPhoto1 = {
        file: expect.any(Blob),
        id: expect.toBeUuidString(),
        type: 'top',
        url: '(set at render time)',
      }
      expect(result.newPhotos).toHaveLength(1)
      expect(result.record.photos).toHaveLength(4)
      const expectedExistingLocalPhoto = {
        tag: 'photo1 placeholder', // existing local photo
        id: -2,
      }
      const expectedExistingBlockedPhoto = {
        tag: 'photo2 placeholder', // existing local blocked photo
        id: -3,
      }
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
            expectedExistingLocalPhoto,
            expectedExistingBlockedPhoto,
            expectedPhoto1,
          ],
          speciesGuess: 'species blah',
          uuid: '123A',
          wowMeta: {
            [constants.recordTypeFieldName]: 'edit',
            [constants.recordProcessingOutcomeFieldName]: 'waiting',
            [constants.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
            [constants.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            [constants.photosToAddFieldName]: [expectedExistingLocalPhoto],
            [constants.blockedActionFieldName]: {
              wowMeta: {
                recordType: 'edit',
                [constants.photosToAddFieldName]: [
                  expectedExistingBlockedPhoto,
                ],
              },
            },
          },
        },
      })
    })

    it('should handle editing a blocked action with a draft', async () => {
      await obsStore.setItem('123A', {
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
      let result
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          localRecords: [{ uuid: '123A' }],
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
        },
        {
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: true,
        },
        (_, params) => (result = params),
      )
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
            [constants.photosToAddFieldName]: [],
            [constants.blockedActionFieldName]: {
              wowMeta: {
                recordType: 'edit',
                [constants.photosToAddFieldName]: [],
              },
            },
          },
        },
      })
    })

    it('should handle editing a blocked action and deleting a photo', async () => {
      await obsStore.setItem('123A', {
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
      let result
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          localRecords: [{ uuid: '123A' }],
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
        },
        {
          record,
          photoIdsToDelete: [888],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
      )
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
            [constants.photosToAddFieldName]: [],
            [constants.blockedActionFieldName]: {
              wowMeta: {
                recordType: 'edit',
                [constants.photosToAddFieldName]: [],
              },
            },
          },
        },
      })
    })

    it('should handle editing a blocked action that has a pending photo delete', async () => {
      await obsStore.setItem('123A', {
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
      let result
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          localRecords: [{ uuid: '123A' }],
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
        },
        {
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
      )
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
            [constants.photosToAddFieldName]: [],
            [constants.blockedActionFieldName]: {
              wowMeta: {
                recordType: 'edit',
                [constants.photosToAddFieldName]: [],
                [constants.photoIdsToDeleteFieldName]: [888],
              },
            },
          },
        },
      })
    })

    it('should handle a two edits, that both delete a photo', async () => {
      await obsStore.setItem('123A', {
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
      let result
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          localRecords: [{ uuid: '123A' }],
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
        },
        {
          record,
          photoIdsToDelete: [889],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
      )
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
            [constants.photosToAddFieldName]: [],
            [constants.photoIdsToDeleteFieldName]: [888],
          },
        },
      })
    })
  })

  describe('getUiVisibleLocalRecords', () => {
    it('should sort records by observedAt date, newest first', async () => {
      const uuids = [
        await createObs('222B', '2020-02-22T22:22:22.222Z'),
        await createObs('111A', '2020-01-11T11:11:11.111Z'),
        await createObs('333C', '2020-03-03T03:33:33.333Z'),
      ]
      const result = await _testonly.getUiVisibleLocalRecords(uuids)
      expect(result.length).toEqual(3)
      expect(result.map(e => e.uuid)).toEqual(['333C', '222B', '111A'])
      async function createObs(uuid, observedAtString) {
        await obsStore.setItem(uuid, {
          uuid,
          observedAt: new Date(observedAtString),
          wowMeta: {
            [constants.photosToAddFieldName]: [],
          },
        })
        return uuid
      }
    })
  })

  it('should reset localForage store for each test', async () => {
    // not completely foolproof but a canary to verify beforeEach
    const result = (await obsStore.keys()).length
    expect(result).toEqual(0)
  })
})

function stubRunStrategy() {
  // do nothing
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
