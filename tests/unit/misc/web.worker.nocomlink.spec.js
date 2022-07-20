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
_testonly.overridePostMessageFn(() => {})

describe('things that need a datastore', () => {
  let origConsoleDebug
  const obsStore = getOrCreateInstance(cc.lfWowObsStoreName)
  const photoStore = getOrCreateInstance(cc.lfWowPhotoStoreName)
  const metaStore = getOrCreateInstance(cc.lfWowMetaStoreName)

  const originalFn = obsStoreCommonTestOnly.interceptableFns.storePhotoRecord
  function stubStorePhotoRecordFn() {
    // stub blob handling to avoid supplying full, valid Blobs for every test.
    obsStoreCommonTestOnly.interceptableFns.storePhotoRecord = async (_, r) => {
      await photoStore.setItem(`${r.id}`, r)
      return r
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
          recordType: 'update',
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
          recordType: 'update',
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
    it('should save an edit that changes speciesGuess on existing edit', async () => {
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
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (editedUuid) => expect(editedUuid).toEqual('123A'),
      )
      const result = await obsStore.getItem('123A')
      expect(result).toEqual({
        inatId: 666,
        photos: [],
        speciesGuess: 'species new',
        uuid: '123A',
        wowMeta: {
          recordType: 'update',
          [cc.recordProcessingOutcomeFieldName]: 'waiting',
          [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.photosToAddFieldName]: [],
          [cc.photoIdsToDeleteFieldName]: [],
          [cc.obsFieldIdsToDeleteFieldName]: [],
          [cc.versionFieldName]: cc.currentRecordVersion,
        },
      })
      expect(wowUpdatedAtToBeCloseToNow(result)).toBe(true)
    })

    it('should add to existing *ToDelete fields', async () => {
      await obsStore.setItem('123A', {
        uuid: '123A',
        wowMeta: {
          recordType: 'update',
          [cc.photoIdsToDeleteFieldName]: [111, 222],
          [cc.obsFieldIdsToDeleteFieldName]: [333, 444],
        },
      })
      const record = {
        uuid: '123A',
        addedPhotos: [],
      }
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          record,
          photoIdsToDelete: [555, 666],
          obsFieldIdsToDelete: [777, 888],
          isDraft: false,
        },
        (editedUuid) => expect(editedUuid).toEqual('123A'),
      )
      const result = await obsStore.getItem('123A')
      expect(result).toEqual({
        photos: [],
        uuid: '123A',
        wowMeta: {
          recordType: 'update',
          [cc.recordProcessingOutcomeFieldName]: 'waiting',
          [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.photosToAddFieldName]: [],
          [cc.photoIdsToDeleteFieldName]: [111, 222, 555, 666],
          [cc.obsFieldIdsToDeleteFieldName]: [333, 444, 777, 888],
          [cc.versionFieldName]: cc.currentRecordVersion,
        },
      })
      expect(wowUpdatedAtToBeCloseToNow(result)).toBe(true)
    })

    it('should save an edit that adds a photo to a local record', async () => {
      const record = {
        uuid: '123A',
        speciesGuess: 'species new',
        addedPhotos: [
          {
            file: new BlobPlaceholder(),
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
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (editedUuid) => expect(editedUuid).toEqual('123A'),
      )
      const result = await obsStore.getItem('123A')
      const expectedPhoto = {
        file: new BlobPlaceholder(),
        id: expect.toBeUuidString(),
        type: 'top',
        url: '(set at render time)',
      }
      expect(result).toEqual({
        photos: [{ id: -1, testTag: 'photo1' }, expectedPhoto],
        speciesGuess: 'species new',
        uuid: '123A',
        wowMeta: {
          recordType: 'update',
          [cc.recordProcessingOutcomeFieldName]: 'waiting',
          [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.photosToAddFieldName]: [
            { id: -1, testTag: 'photo1' },
            expectedPhoto,
          ],
          [cc.obsFieldIdsToDeleteFieldName]: [],
          [cc.photoIdsToDeleteFieldName]: [],
          [cc.versionFieldName]: cc.currentRecordVersion,
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
      await metaStore.setItem(cc.remoteObsKey, [{ uuid: '123A', inatId: 888 }])
      const record = {
        uuid: '123A',
        speciesGuess: 'species new',
        addedPhotos: [],
      }
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (editedUuid) => expect(editedUuid).toEqual('123A'),
      )
      const result = await obsStore.getItem('123A')
      expect(result).toEqual({
        inatId: 888,
        photos: [],
        speciesGuess: 'species new',
        uuid: '123A',
        wowMeta: {
          recordType: 'update',
          [cc.recordProcessingOutcomeFieldName]: 'waiting',
          [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.photosToAddFieldName]: [],
          [cc.photoIdsToDeleteFieldName]: [],
          [cc.obsFieldIdsToDeleteFieldName]: [],
          [cc.versionFieldName]: cc.currentRecordVersion,
        },
      })
    })

    it('should save an edit of a remote record that adds a photo', async () => {
      const newPhoto = {
        file: new BlobPlaceholder(),
        type: 'top',
      }
      await metaStore.setItem(cc.remoteObsKey, [{ uuid: '123A', inatId: 873 }])
      const record = {
        uuid: '123A',
        addedPhotos: [newPhoto],
      }
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (editedUuid) => expect(editedUuid).toEqual('123A'),
      )
      const expectedPhoto1 = {
        file: new BlobPlaceholder(),
        id: expect.toBeUuidString(),
        type: 'top',
        url: '(set at render time)',
      }
      const result = await obsStore.getItem('123A')
      expect(result).toEqual({
        inatId: 873,
        photos: [expectedPhoto1],
        uuid: '123A',
        wowMeta: {
          [cc.recordTypeFieldName]: 'update',
          [cc.recordProcessingOutcomeFieldName]: 'waiting',
          [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.photosToAddFieldName]: [expectedPhoto1],
          [cc.photoIdsToDeleteFieldName]: [],
          [cc.obsFieldIdsToDeleteFieldName]: [],
          [cc.versionFieldName]: cc.currentRecordVersion,
        },
      })
    })

    it('should not duplicate photos when saving an edit', async () => {
      const existingLocalPhoto = { id: -1, tag: 'photo1 placeholder' }
      const existingRemotePhoto = {
        id: 888,
        isRemote: true,
        url: 'http://whatever...',
      }
      await obsStore.setItem('928Z', {
        uuid: '928Z',
        inatId: 666,
        photos: [existingRemotePhoto, existingLocalPhoto],
        wowMeta: {
          [cc.photosToAddFieldName]: [existingLocalPhoto],
        },
      })
      await metaStore.setItem(cc.remoteObsKey, [
        { uuid: '928Z', inatId: 666, photos: [existingRemotePhoto] },
      ])
      const record = {
        uuid: '928Z',
        addedPhotos: [
          {
            file: new BlobPlaceholder(),
            type: 'top',
          },
        ],
      }
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (editedUuid) => expect(editedUuid).toEqual('928Z'),
      )
      const result = await obsStore.getItem('928Z')
      const expectedExistingLocalPhoto = { id: -2, tag: 'photo1 placeholder' }
      const expectedNewPhoto = {
        file: new BlobPlaceholder(),
        id: expect.toBeUuidString(),
        type: 'top',
        url: '(set at render time)',
      }
      expect(result.photos.length).toEqual(3)
      expect(result).toEqual({
        inatId: 666,
        photos: [
          // all photos should be here for UI
          existingRemotePhoto,
          expectedExistingLocalPhoto,
          expectedNewPhoto,
        ],
        uuid: '928Z',
        wowMeta: {
          recordType: 'update',
          [cc.recordProcessingOutcomeFieldName]: 'waiting',
          [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.photosToAddFieldName]: [
            expectedExistingLocalPhoto,
            expectedNewPhoto,
          ],
          [cc.obsFieldIdsToDeleteFieldName]: [],
          [cc.photoIdsToDeleteFieldName]: [],
          [cc.versionFieldName]: cc.currentRecordVersion,
        },
      })
    })

    it('should save an edit that deletes a (remote) photo', async () => {
      const record = {
        uuid: '123A',
        addedPhotos: [],
      }
      await metaStore.setItem(cc.remoteObsKey, [
        { uuid: '123A', inatId: 929, photos: [{ id: 841 }] },
      ])
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          record,
          photoIdsToDelete: [841],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (editedUuid) => expect(editedUuid).toEqual('123A'),
      )
      const result = await obsStore.getItem('123A')
      expect(result).toEqual({
        inatId: 929,
        photos: [],
        uuid: '123A',
        wowMeta: {
          [cc.recordTypeFieldName]: 'update',
          [cc.recordProcessingOutcomeFieldName]: 'waiting',
          [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.photosToAddFieldName]: [],
          [cc.photoIdsToDeleteFieldName]: [841],
          [cc.obsFieldIdsToDeleteFieldName]: [],
          [cc.versionFieldName]: cc.currentRecordVersion,
        },
      })
    })

    it('should save an edit that deletes an obs field', async () => {
      const record = {
        uuid: '123A',
        speciesGuess: 'species blah',
        addedPhotos: [],
      }
      await metaStore.setItem(cc.remoteObsKey, [{ uuid: '123A', inatId: 928 }])
      let isSendFnCalled = false
      await objectUnderTest.saveEditAndScheduleUpdate(
        {
          record,
          photoIdsToDelete: [],
          obsFieldIdsToDelete: [32423],
          isDraft: false,
        },
        (editedUuid) => {
          expect(editedUuid).toEqual('123A')
          isSendFnCalled = true
        },
      )
      expect(isSendFnCalled).toBeTruthy()
      const result = await obsStore.getItem('123A')
      expect(result).toEqual({
        inatId: 928,
        photos: [],
        speciesGuess: 'species blah',
        uuid: '123A',
        wowMeta: {
          [cc.recordTypeFieldName]: 'update',
          [cc.recordProcessingOutcomeFieldName]: 'waiting',
          [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.photosToAddFieldName]: [],
          [cc.photoIdsToDeleteFieldName]: [],
          [cc.obsFieldIdsToDeleteFieldName]: [32423],
          [cc.versionFieldName]: cc.currentRecordVersion,
        },
      })
    })

    it('should handle two edits, that both delete a photo each', async () => {
      await obsStore.setItem('123A', {
        // one edit already done
        uuid: '123A',
        photos: [{ id: 889 }],
        wowMeta: {
          [cc.recordTypeFieldName]: 'update',
          [cc.photosToAddFieldName]: [],
          [cc.photoIdsToDeleteFieldName]: [888],
        },
      })
      const record = {
        uuid: '123A',
        inatId: 667,
        addedPhotos: [],
      }
      await objectUnderTest.saveEditAndScheduleUpdate(
        // do a second edit
        {
          record,
          photoIdsToDelete: [889],
          obsFieldIdsToDelete: [],
          isDraft: false,
        },
        (editedUuid) => expect(editedUuid).toEqual('123A'),
      )
      const result = await obsStore.getItem('123A')
      expect(result).toEqual({
        inatId: 667,
        photos: [], // second remote photo should be deleted
        uuid: '123A',
        wowMeta: {
          [cc.recordTypeFieldName]: 'update',
          [cc.recordProcessingOutcomeFieldName]: 'waiting',
          [cc.wowUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.outcomeLastUpdatedAtFieldName]: expect.toBeValidDateString(),
          [cc.photosToAddFieldName]: [],
          [cc.photoIdsToDeleteFieldName]: [888, 889],
          [cc.obsFieldIdsToDeleteFieldName]: [],
          [cc.versionFieldName]: cc.currentRecordVersion,
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

  describe('getLocalQueueSummary', () => {
    it('should see a new record as UI visible', async () => {
      const record = {
        uuid: '123A',
        photos: [],
        wowMeta: {
          [cc.recordTypeFieldName]: 'update',
          [cc.recordProcessingOutcomeFieldName]: 'waiting',
          [cc.photosToAddFieldName]: [],
        },
      }
      await obsStore.setItem('123A', record)
      const result = await objectUnderTest.getLocalQueueSummary()
      expect(result).toEqual([
        {
          geolocationAccuracy: undefined,
          inatId: undefined,
          lat: undefined,
          lng: undefined,
          observedAt: undefined,
          speciesGuess: undefined,
          thumbnailUrl: null,
          uuid: '123A',
          wowMeta: {
            [cc.isEventuallyDeletedFieldName]: false, // this means UI visible
            [cc.photosToAddFieldName]: [],
            [cc.recordProcessingOutcomeFieldName]: 'waiting',
            [cc.recordTypeFieldName]: 'update',
            isDraft: false,
            isPossiblyStuck: false,
            outcomeLastUpdatedAt: undefined,
            [cc.versionFieldName]: undefined,
            wowUpdatedAt: undefined,
          },
        },
      ])
    })

    it('should see record with a pending delete task as NOT UI visible', async () => {
      const record = {
        uuid: '123A',
        inatId: 33,
        photos: [],
        wowMeta: {
          [cc.recordTypeFieldName]: 'update',
          [cc.recordProcessingOutcomeFieldName]: 'success',
        },
      }
      await obsStore.setItem('123A', record)
      await metaStore.setItem(cc.remoteObsKey, [{ uuid: '123A', inatId: 33 }])
      const statusUrl = '/blah'
      await _testonly._deleteRecord('123A', null, () => ({
        statusUrl,
      }))
      const result = await objectUnderTest.getLocalQueueSummary()
      expect(result).toEqual([
        {
          geolocationAccuracy: undefined,
          inatId: 33,
          lat: undefined,
          lng: undefined,
          observedAt: undefined,
          speciesGuess: undefined,
          thumbnailUrl: null,
          uuid: '123A',
          wowMeta: {
            [cc.isEventuallyDeletedFieldName]: true,
            [cc.photosToAddFieldName]: [],
            [cc.recordProcessingOutcomeFieldName]: 'success',
            [cc.recordTypeFieldName]: 'delete',
            isDraft: false,
            isPossiblyStuck: false,
            outcomeLastUpdatedAt: expect.any(String),
            [cc.versionFieldName]: cc.currentRecordVersion,
            wowUpdatedAt: expect.any(String),
          },
        },
      ])
      const pendingTasks = await metaStore.getItem(cc.pendingTasksKey)
      expect(pendingTasks).toEqual({
        '123A': {
          dateAdded: expect.any(String),
          inatId: 33,
          statusUrl,
          type: 'delete',
          uuid: '123A',
        },
      })
    })
  })

  describe('_deleteRecord', () => {
    it('should queue a delete action for the remote record', async () => {
      await metaStore.setItem(cc.remoteObsKey, [{ uuid: '123A', inatId: 661 }])
      let actualRemoteDeleteUrl = null
      await _testonly._deleteRecord(
        '123A',
        null,
        (url) => (actualRemoteDeleteUrl = url),
      )
      const obsRecord = await obsStore.getItem('123A')
      expect(obsRecord).toEqual({
        inatId: 661,
        uuid: '123A',
        wowMeta: {
          [cc.recordTypeFieldName]: 'delete',
          [cc.recordProcessingOutcomeFieldName]: 'success',
          outcomeLastUpdatedAt: expect.any(String),
          [cc.versionFieldName]: cc.currentRecordVersion,
          wowUpdatedAt: expect.any(String),
        },
      })
      const pendingTasks = await metaStore.getItem(cc.pendingTasksKey)
      expect(pendingTasks['123A'].inatId).toEqual(661)
      expect(
        actualRemoteDeleteUrl.endsWith('/observations/661/123A'),
      ).toBeTruthy()
    })

    it('should clobber existing edit task', async () => {
      await obsStore.setItem('123A', {
        uuid: '123A',
        photos: [],
        wowMeta: {
          [cc.recordProcessingOutcomeFieldName]: 'waiting',
          [cc.recordTypeFieldName]: 'update',
          [cc.photoIdsToDeleteFieldName]: ['this should get clobbered'],
          [cc.photosToAddFieldName]: [],
        },
      })
      await metaStore.setItem(cc.remoteObsKey, [{ uuid: '123A', inatId: 666 }])
      const statusUrl = '/status'
      await _testonly._deleteRecord('123A', null, () => ({ statusUrl }))
      const result = await obsStore.getItem('123A')
      expect(result).toEqual({
        inatId: 666,
        uuid: '123A',
        photos: [],
        wowMeta: {
          [cc.recordTypeFieldName]: 'delete',
          [cc.recordProcessingOutcomeFieldName]: 'success',
          [cc.photoIdsToDeleteFieldName]: [], // field *was* clobbered!
          [cc.photosToAddFieldName]: [],
          outcomeLastUpdatedAt: expect.any(String),
          [cc.versionFieldName]: cc.currentRecordVersion,
          wowUpdatedAt: expect.any(String),
        },
      })
    })

    it('should still send a delete request for a record without inatId', async () => {
      await obsStore.setItem('123A', {
        uuid: '123A',
        photos: [],
        wowMeta: {
          [cc.recordProcessingOutcomeFieldName]: 'success',
          [cc.recordTypeFieldName]: 'update',
          [cc.photosToAddFieldName]: [],
        },
      })
      await metaStore.setItem(cc.remoteObsKey, [])
      let actualRemoteDeleteUrl = null
      const statusUrl = '/blah-blah'
      await _testonly._deleteRecord('123A', null, (url) => {
        actualRemoteDeleteUrl = url
        return { statusUrl }
      })
      const result = await obsStore.getItem('123A')
      expect(result.wowMeta[cc.recordTypeFieldName]).toEqual('delete')
      expect(
        actualRemoteDeleteUrl.endsWith('/observations/0/123A'),
      ).toBeTruthy()
      const pendingTasks = await metaStore.getItem(cc.pendingTasksKey)
      expect(pendingTasks).toEqual({
        '123A': {
          dateAdded: expect.any(String),
          inatId: 0,
          statusUrl,
          type: 'delete',
          uuid: '123A',
        },
      })
    })
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

// fake-indexeddb cannot handle Blobs, it throws an error like
//   The data being stored could not be cloned by the internal structured cloning algorithm.
// So we don't use real blobs.
function BlobPlaceholder() {
  this.msg = 'blob placeholder'
}
