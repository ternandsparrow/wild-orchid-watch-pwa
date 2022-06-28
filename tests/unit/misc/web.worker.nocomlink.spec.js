/**
 * @jest-environment jsdom
 */
import dayjs from 'dayjs'
import { getOrCreateInstance } from '@/indexeddb/storage-manager'
import * as cc from '@/misc/constants'
import * as objectUnderTest from '@/misc/web.worker.nocomlink'
import { _testonly as obsStoreCommonTestOnly } from '@/indexeddb/obs-store-common'
import {
  byteLengthOfThumbnail,
  getPhotoWithThumbnail,
  sizeOfPhotoWithExifThumbnail,
} from '@/../tests/unit/test-helpers'

const { _testonly } = objectUnderTest

// FIXME remove all tests for blocked actions
// FIXME fix recordType [new, edit] to be 'update'

describe('things that need a datastore', () => {
  let origConsoleDebug
  const obsStore = getOrCreateInstance(cc.lfWowObsStoreName)
  const photoStore = getOrCreateInstance(cc.lfWowPhotoStoreName)
  const metaStore = getOrCreateInstance(cc.lfWowMetaStoreName)

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

  beforeAll(function () {
    stubStorePhotoRecordFn()
    origConsoleDebug = console.debug
    console.debug = () => {}
  })

  beforeEach(async () => {
    await obsStore.clear()
    await photoStore.clear()
    await metaStore.clear()
  })

  afterAll(async () => {
    await obsStore.clear()
    await photoStore.clear()
    await metaStore.clear()
    console.debug = origConsoleDebug
  })

  describe('upsertBlockedAction', () => {
    it('should create the blocked action when none exists', async () => {
      await obsStore.setItem('123A', {
        uuid: '123A',
        someField: 'old value',
        wowMeta: {
          [cc.recordTypeFieldName]: 'new',
          [cc.blockedActionFieldName]: null,
        },
      })
      const record = {
        uuid: '123A',
        someField: 'new value',
        wowMeta: {
          [cc.recordTypeFieldName]: 'edit',
        },
      }
      await _testonly.upsertBlockedAction({
        record,
      })
      const result = await obsStore.getItem('123A')
      expect(result.someField).toEqual('new value')
      expect(result.wowMeta[cc.recordTypeFieldName]).toEqual('new')
      expect(
        result.wowMeta[cc.blockedActionFieldName].wowMeta[
          cc.recordTypeFieldName
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
            [cc.recordTypeFieldName]: 'new',
            [cc.photoIdsToDeleteFieldName]: [21, 22],
            [cc.blockedActionFieldName]: {
              wowMeta: {
                [cc.photoIdsToDeleteFieldName]: [23, 24],
              },
            },
          },
        })
        const record = {
          uuid: '123A',
          wowMeta: {
            [cc.recordTypeFieldName]: 'edit',
          },
        }
        const newPhotoIdsToDelete = [25, 26]
        await _testonly.upsertBlockedAction({
          record,
          photoIdsToDelete: newPhotoIdsToDelete,
        })
        const result = await obsStore.getItem('123A')
        expect(result.wowMeta[cc.photoIdsToDeleteFieldName]).toEqual([21, 22])
        expect(
          result.wowMeta[cc.blockedActionFieldName].wowMeta[
            cc.photoIdsToDeleteFieldName
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
          [cc.recordTypeFieldName]: 'new',
          [cc.photosToAddFieldName]: [existingLocalPhoto],
          [cc.blockedActionFieldName]: {
            wowMeta: {
              [cc.photosToAddFieldName]: [existingBlockedPhoto],
            },
          },
        },
      })
      const record = {
        ...baseRecord,
        wowMeta: {
          [cc.recordTypeFieldName]: 'edit',
        },
      }
      const newPhotos = []
      await _testonly.upsertBlockedAction({
        record,
        newPhotos,
      })
      const result = await obsStore.getItem('123A')
      expect(result.wowMeta[cc.photosToAddFieldName]).toEqual([
        { id: '11', testTag: 'photo1 placeholder', thumb: true },
      ])
      expect(
        result.wowMeta[cc.blockedActionFieldName].wowMeta[
          cc.photosToAddFieldName
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
            [cc.recordTypeFieldName]: 'new',
            [cc.photosToAddFieldName]: [existingLocalPhoto],
            [cc.blockedActionFieldName]: {
              wowMeta: {
                [cc.photosToAddFieldName]: [existingBlockedPhoto],
              },
            },
          },
        })
        const newPhoto = { id: '33', testTag: 'photo3 placeholder' }
        const record = {
          uuid: '123A',
          photos: [...baseRecord.photos, newPhoto],
          wowMeta: {
            [cc.recordTypeFieldName]: 'edit',
          },
        }
        const newPhotos = [newPhoto]
        await _testonly.upsertBlockedAction({
          record,
          newPhotos,
        })
        const result = await obsStore.getItem('123A')
        expect(result.wowMeta[cc.photosToAddFieldName]).toEqual([
          { id: '11', testTag: 'photo1 placeholder', thumb: true },
        ])
        expect(
          result.wowMeta[cc.blockedActionFieldName].wowMeta[
            cc.photosToAddFieldName
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
            [cc.recordTypeFieldName]: 'new',
            [cc.obsFieldIdsToDeleteFieldName]: [31, 32],
            [cc.blockedActionFieldName]: {
              wowMeta: {
                [cc.obsFieldIdsToDeleteFieldName]: [33, 34],
              },
            },
          },
        })
        const record = {
          uuid: '123A',
          wowMeta: {
            [cc.recordTypeFieldName]: 'edit',
          },
        }
        const newObsFieldIdsToDelete = [35, 36]
        await _testonly.upsertBlockedAction({
          record,
          obsFieldIdsToDelete: newObsFieldIdsToDelete,
        })
        const result = await obsStore.getItem('123A')
        expect(result.wowMeta[cc.obsFieldIdsToDeleteFieldName]).toEqual([
          31, 32,
        ])
        expect(
          result.wowMeta[cc.blockedActionFieldName].wowMeta[
            cc.obsFieldIdsToDeleteFieldName
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
            [cc.recordTypeFieldName]: 'new',
          },
        })
        const record = {
          uuid: '123A',
          wowMeta: {
            [cc.recordTypeFieldName]: 'edit',
            wowUpdatedAt: 'some time string',
          },
        }
        await _testonly.upsertBlockedAction({
          record,
        })
        const result = await obsStore.getItem('123A')
        expect(result.wowMeta.wowUpdatedAt).toBeUndefined()
        expect(
          result.wowMeta[cc.blockedActionFieldName].wowMeta.wowUpdatedAt,
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
          [cc.recordProcessingOutcomeFieldName]: 'the-supplied-outcome',
        },
      }
      await _testonly.upsertQueuedAction({ record })
      const result = await obsStore.getItem('123A')
      expect(result.testRecord).toBeTruthy()
      expect(result.wowMeta[cc.recordProcessingOutcomeFieldName]).toEqual(
        'the-supplied-outcome',
      )
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
          [cc.photoIdsToDeleteFieldName]: [11, 22, 33],
        },
      }
      await obsStore.setItem('123A', record)
      const newPhotoIdsToDelete = [44]
      await _testonly.upsertQueuedAction({
        record,
        photoIdsToDelete: newPhotoIdsToDelete,
      })
      const result = await obsStore.getItem('123A')
      expect(result.wowMeta[cc.photoIdsToDeleteFieldName]).toEqual([
        11, 22, 33, 44,
      ])
    })

    it('should set photoIdsToDelete when none are already tagged for deletion', async () => {
      const record = {
        uuid: '123A',
        wowMeta: {
          [cc.photoIdsToDeleteFieldName]: null,
        },
      }
      await obsStore.setItem('123A', record)
      const newPhotoIdsToDelete = [44]
      await _testonly.upsertQueuedAction({
        record,
        photoIdsToDelete: newPhotoIdsToDelete,
      })
      const result = await obsStore.getItem('123A')
      expect(result.wowMeta[cc.photoIdsToDeleteFieldName]).toEqual([44])
    })

    it('should set newPhotos when none are already pending', async () => {
      const newPhoto = { id: '11', testTag: 'photo 1' }
      const record = {
        uuid: '123A',
        photos: [newPhoto],
        wowMeta: {
          [cc.photosToAddFieldName]: null,
        },
      }
      await obsStore.setItem('123A', record)
      const newPhotos = [newPhoto]
      await _testonly.upsertQueuedAction({
        record,
        newPhotos,
      })
      const result = await obsStore.getItem('123A')
      expect(result.wowMeta[cc.photosToAddFieldName]).toEqual([
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
          [cc.photosToAddFieldName]: [existingPhoto],
        },
      }
      await obsStore.setItem('123A', record)
      const newPhotos = [newPhoto]
      await _testonly.upsertQueuedAction({
        record,
        newPhotos,
      })
      const result = await obsStore.getItem('123A')
      expect(result.wowMeta[cc.photosToAddFieldName]).toEqual([
        { id: '11', testTag: 'photo 1', thumb: true },
        { id: '22', testTag: 'photo 2', thumb: true },
      ])
    })

    it('should merge obsFieldIdsToDelete with the existing', async () => {
      const record = {
        uuid: '123A',
        wowMeta: {
          [cc.obsFieldIdsToDeleteFieldName]: [11, 22, 33],
        },
      }
      await obsStore.setItem('123A', record)
      const newObsFieldIdsToDelete = [44]
      await _testonly.upsertQueuedAction({
        record,
        obsFieldIdsToDelete: newObsFieldIdsToDelete,
      })
      const result = await obsStore.getItem('123A')
      expect(result.wowMeta[cc.obsFieldIdsToDeleteFieldName]).toEqual([
        11, 22, 33, 44,
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
      let sendToFacadeNewRecordIdParam = null
      const newRecordId = await objectUnderTest.saveNewAndScheduleUpload(
        {
          record,
          isDraft: true,
        },
        (newRecordIdParam) => {
          sendToFacadeNewRecordIdParam = newRecordIdParam
        },
      )
      expect(sendToFacadeNewRecordIdParam).toEqual(newRecordId)
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
          [cc.photosToAddFieldName]: [],
          [cc.photoIdsToDeleteFieldName]: [],
          [cc.obsFieldIdsToDeleteFieldName]: [],
          [cc.recordProcessingOutcomeFieldName]: 'draft',
          [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.versionFieldName]: cc.currentRecordVersion,
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
      const newRecordId = await objectUnderTest.saveNewAndScheduleUpload(
        {
          record,
          isDraft: false,
        },
        () => {},
      )
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
          [cc.photosToAddFieldName]: [expectedPhoto1, expectedPhoto2],
          [cc.photoIdsToDeleteFieldName]: [],
          [cc.obsFieldIdsToDeleteFieldName]: [],
          [cc.recordProcessingOutcomeFieldName]: 'waiting',
          [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.versionFieldName]: cc.currentRecordVersion,
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
      stubStorePhotoRecordFn() // because we undid the stub at the start
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
      let sendToFacadeEditedUuidParam = null
      let result
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
        (editedUuid) => {
          sendToFacadeEditedUuidParam = editedUuid
        },
      )
      expect(sendToFacadeEditedUuidParam).toEqual('123A')
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
            [cc.recordProcessingOutcomeFieldName]: 'waiting',
            [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
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
          [cc.photosToAddFieldName]: [{ id: -1, testTag: 'photo1' }],
        },
      })
      let result
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
        () => {},
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
            [cc.recordProcessingOutcomeFieldName]: 'waiting',
            [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.photosToAddFieldName]: [{ id: -1, testTag: 'photo1' }],
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
            {
              record,
              photoIdsToDelete: [],
              obsFieldIdsToDelete: [],
            },
            stubRunStrategy,
            () => {},
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
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
        () => {},
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
            [cc.recordProcessingOutcomeFieldName]: 'waiting',
            [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
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
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
        () => {},
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
            [cc.recordProcessingOutcomeFieldName]: 'waiting',
            [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
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
          [cc.photosToAddFieldName]: [existingLocalPhoto],
        },
      })
      const newPhoto = {
        file: new Blob([0xff, 0xd8], { type: 'image/jpeg' }),
        type: 'top',
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
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
        () => {},
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
            [cc.recordProcessingOutcomeFieldName]: 'waiting',
            [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.photosToAddFieldName]: [expectedExistingLocalPhoto],
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
          record,
          photoIdsToDelete: [841],
          obsFieldIdsToDelete: [],
          isDraft: true,
        },
        (_, params) => (result = params),
        () => {},
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
            [cc.recordProcessingOutcomeFieldName]: 'draft',
            [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
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
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [32423],
          isDraft: false,
        },
        (_, params) => (result = params),
        () => {},
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
            [cc.recordProcessingOutcomeFieldName]: 'waiting',
            [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
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
          [cc.photosToAddFieldName]: [existingLocalPhoto],
          [cc.blockedActionFieldName]: {
            wowMeta: {
              recordType: 'edit',
              [cc.photosToAddFieldName]: [existingBlockedLocalPhoto],
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
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
        () => {},
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
            [cc.recordTypeFieldName]: 'edit',
            // the edit resets the outcome to waiting
            [cc.recordProcessingOutcomeFieldName]: 'waiting',
            [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.photosToAddFieldName]: [expectedExistingLocalPhoto],
            [cc.blockedActionFieldName]: {
              wowMeta: {
                recordType: 'edit',
                [cc.photosToAddFieldName]: [expectedExistingBlockedPhoto],
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
          [cc.photosToAddFieldName]: [existingLocalPhoto],
          [cc.blockedActionFieldName]: {
            wowMeta: {
              recordType: 'edit',
              [cc.photosToAddFieldName]: [existingBlockedLocalPhoto],
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
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
        () => {},
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
            [cc.recordTypeFieldName]: 'edit',
            [cc.recordProcessingOutcomeFieldName]: 'waiting',
            [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.photosToAddFieldName]: [expectedExistingLocalPhoto],
            [cc.blockedActionFieldName]: {
              wowMeta: {
                recordType: 'edit',
                [cc.photosToAddFieldName]: [expectedExistingBlockedPhoto],
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
          [cc.photosToAddFieldName]: [],
          [cc.blockedActionFieldName]: {
            wowMeta: {
              recordType: 'edit',
              [cc.photosToAddFieldName]: [],
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
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: true,
        },
        (_, params) => (result = params),
        () => {},
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
            [cc.recordTypeFieldName]: 'edit',
            [cc.recordProcessingOutcomeFieldName]: 'draft',
            [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.photosToAddFieldName]: [],
            [cc.blockedActionFieldName]: {
              wowMeta: {
                recordType: 'edit',
                [cc.photosToAddFieldName]: [],
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
          [cc.photosToAddFieldName]: [],
          [cc.blockedActionFieldName]: {
            wowMeta: {
              recordType: 'edit',
              [cc.photosToAddFieldName]: [],
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
          record,
          photoIdsToDelete: [888],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
        () => {},
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
            [cc.recordTypeFieldName]: 'edit',
            [cc.recordProcessingOutcomeFieldName]: 'waiting',
            [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.photosToAddFieldName]: [],
            [cc.blockedActionFieldName]: {
              wowMeta: {
                recordType: 'edit',
                [cc.photosToAddFieldName]: [],
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
          [cc.photosToAddFieldName]: [],
          [cc.blockedActionFieldName]: {
            wowMeta: {
              recordType: 'edit',
              [cc.photosToAddFieldName]: [],
              [cc.photoIdsToDeleteFieldName]: [888],
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
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
        () => {},
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
            [cc.recordTypeFieldName]: 'edit',
            [cc.recordProcessingOutcomeFieldName]: 'waiting',
            [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.photosToAddFieldName]: [],
            [cc.blockedActionFieldName]: {
              wowMeta: {
                recordType: 'edit',
                [cc.photosToAddFieldName]: [],
                [cc.photoIdsToDeleteFieldName]: [888],
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
          [cc.photosToAddFieldName]: [],
          [cc.photoIdsToDeleteFieldName]: [888],
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
          record,
          photoIdsToDelete: [889],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (_, params) => (result = params),
        () => {},
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
            [cc.recordTypeFieldName]: 'edit',
            [cc.recordProcessingOutcomeFieldName]: 'waiting',
            [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
            [cc.photosToAddFieldName]: [],
            [cc.photoIdsToDeleteFieldName]: [888],
          },
        },
      })
    })
  })

  describe('cancelFailedDeletes', () => {
    it('should run without error when there is nothing to do', async () => {
      await objectUnderTest.cancelFailedDeletes([])
      // no errors is a success
    })

    it('should remove delete action records from the DB when required', async () => {
      await obsStore.setItem('123A', {
        uuid: '123A',
      })
      await objectUnderTest.cancelFailedDeletes(['123A'])
      const result = await obsStore.getItem('123A')
      expect(result).toBeNull()
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
        await objectUnderTest.cleanLocalRecord('123A')
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
      await objectUnderTest.cleanLocalRecord('123A', {
        inatId: 667,
        someRemoteField: 'test',
      })
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
      expect(objectUnderTest.cleanLocalRecord('123A', null)).rejects.toThrow(
        'Blocked action present, but no summary passed for UUID=123A',
      )
    })
  })

  describe('refreshLocalRecordQueue', () => {
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
      const result = await objectUnderTest.actions.refreshLocalRecordQueue()
      expect(result).toEqual([
        {
          [cc.recordTypeFieldName]: 'new',
          [cc.isEventuallyDeletedFieldName]: false, // this means UI visible
          [cc.recordProcessingOutcomeFieldName]: 'waiting',
          inatId: undefined,
          uuid: '123A',
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
          inatId: 33,
          uuid: '123A',
        },
      ])
      expect(committedState.setUiVisibleLocalRecords).toEqual([])
    })
  })

  describe('deleteRecord', () => {
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
        await _testonly._deleteRecord('123A', null, () => {})
        const result = await obsStore.getItem('123A')
        expect(result).toBeNull()
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
        await _testonly._deleteRecord('123A', null, () => {})
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
      await metaStore.setItem(cc.remoteObsKey, [{ uuid: '123A', inatId: 666 }])
      let actualRemoteDeleteUrl = null
      await _testonly._deleteRecord(
        '123A',
        null,
        (url) => (actualRemoteDeleteUrl = url),
      )
      expect(await obsStore.getItem('123A')).toBeNull()
      const result = await metaStore.getItem(cc.pendingTasksKey)
      expect(result['123A'].inatId).toEqual(666)
      expect(actualRemoteDeleteUrl.endsWith('/observations/666')).toBeTruthy()
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
        await metaStore.setItem(cc.remoteObsKey, [
          { uuid: '123A', inatId: 666 },
        ])
        await _testonly._deleteRecord('123A', null, () => {})
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
        await metaStore.setItem(cc.remoteObsKey, [
          { uuid: '123A', inatId: 666 },
        ])
        await _testonly._deleteRecord('123A', null, () => {})
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
      },
    )
  })

  it('should reset localForage store for each test', async () => {
    // not completely foolproof but a canary to verify beforeEach
    const result = (await obsStore.keys()).length
    expect(result).toEqual(0)
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
        url: 'http://dev.inat.techotom.com/attachments/local_photos/files/14/square/10425011_10152561992129730_7715615756023856816_n.jpg?1563423348',
        isRemote: true,
      },
      {
        id: 14,
        uuid: '557fc632-637f-4093-ad2f-74540c980fc1',
        url: 'http://dev.inat.techotom.com/attachments/local_photos/files/15/square/10501641_10152561922694730_8539909549430640775_n.jpg?1563423350',
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
        url: 'http://dev.inat.techotom.com/attachments/local_photos/files/14/square/10425011_10152561992129730_7715615756023856816_n.jpg?1563423348',
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
        url: 'http://dev.inat.techotom.com/attachments/local_photos/files/15/square/10501641_10152561922694730_8539909549430640775_n.jpg?1563423350',
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
          url: 'http://dev.inat.techotom.com/attachments/local_photos/files/14/square/10425011_10152561992129730_7715615756023856816_n.jpg?1563423348',
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
          url: 'http://dev.inat.techotom.com/attachments/local_photos/files/15/square/10501641_10152561922694730_8539909549430640775_n.jpg?1563423350',
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
