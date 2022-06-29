/**
 * @jest-environment jsdom
 */
import _ from 'lodash'
import uuid from 'uuid/v1'
import * as objectUnderTest from '@/indexeddb/obs-store-common'
import { blobToArrayBuffer } from '@/misc/only-common-deps-helpers'
import { getOrCreateInstance } from '@/indexeddb/storage-manager'
import * as cc from '@/misc/constants'
import {
  byteLengthOfThumbnail,
  getPhotoNoExif,
  getPhotoNoThumbnail,
  getPhotoWithThumbnail,
  sizeOfPhotoNoExif,
  sizeOfPhotoWithExifNoThumbnail,
  sizeOfPhotoWithExifThumbnail,
} from '@/../tests/unit/test-helpers'

objectUnderTest.registerUuidGenerator(uuid)

describe('obs-store-common', () => {
  let origConsoleDebug
  const testObsStore = getOrCreateInstance('test-store')
  const testPhotoStore = getOrCreateInstance('test-photo-store')
  const testMetaStore = getOrCreateInstance('test-meta-store')
  async function clearStores() {
    await testObsStore.clear()
    await testPhotoStore.clear()
    await testMetaStore.clear()
  }

  beforeAll(function () {
    origConsoleDebug = console.debug
    console.debug = () => {}
  })

  beforeEach(clearStores)

  afterAll(async () => {
    console.debug = origConsoleDebug
    await clearStores()
  })

  describe('storeRecord', () => {
    it('should store a valid record, without photos', async () => {
      const record = {
        uuid: '123A',
        foo: 'bar',
        wowMeta: {},
      }
      await objectUnderTest._testonly.storeRecordImpl(
        testObsStore,
        testPhotoStore,
        record,
      )
      const result = await testObsStore.getItem('123A')
      expect(result.foo).toEqual('bar')
    })

    it('should be able to get a stored photo', async () => {
      const photoId = '33888'
      const newPhoto = {
        file: getPhotoWithThumbnail(),
        id: photoId,
        type: 'top',
      }
      const record = {
        uuid: '123A',
        photos: [newPhoto],
        wowMeta: {
          [cc.photosToAddFieldName]: [newPhoto],
        },
      }
      await objectUnderTest._testonly.storeRecordImpl(
        testObsStore,
        testPhotoStore,
        record,
      )
      const result = await objectUnderTest._testonly.getPhotoRecordImpl(
        testPhotoStore,
        photoId,
      )
      expect(result.file.data.byteLength).toEqual(sizeOfPhotoWithExifThumbnail)
    })

    it('should store a record and extract the photos to a separate store', async () => {
      const newPhoto = {
        file: getPhotoWithThumbnail(),
        id: '1234',
        type: 'top',
      }
      const record = {
        uuid: '123A',
        photos: [newPhoto],
        wowMeta: {
          [cc.photosToAddFieldName]: [newPhoto],
        },
      }
      await objectUnderTest._testonly.storeRecordImpl(
        testObsStore,
        testPhotoStore,
        record,
      )
      const result = await testObsStore.getItem('123A')
      const photos = result.wowMeta[cc.photosToAddFieldName]
      expect(photos.map((e) => e.id)).toEqual(['1234'])
      expect(photos[0].file.data.byteLength).toEqual(byteLengthOfThumbnail)
      const photoDbId = photos[0].id
      const photoRecord = await testPhotoStore.getItem(photoDbId)
      expect(photoRecord).toEqual({
        file: {
          data: expect.any(ArrayBuffer),
          mime: 'image/jpeg',
        },
        id: photoDbId,
        type: 'top',
      })
      expect(photoRecord.file.data.byteLength).toEqual(
        sizeOfPhotoWithExifThumbnail,
      )
    })

    it('should fix inconsistent data by adding the thumbnail to the photos array', async () => {
      // I have a feeling this is masking another bug :(
      const newPhoto = {
        file: getPhotoWithThumbnail(),
        id: '1234',
        type: 'top',
      }
      const record = {
        uuid: '123A',
        photos: [
          /* photo is missing from here */
        ],
        wowMeta: {
          [cc.photosToAddFieldName]: [newPhoto],
        },
      }
      let warnMsg
      objectUnderTest.registerWarnHandler((msg) => (warnMsg = msg))
      await objectUnderTest._testonly.storeRecordImpl(
        testObsStore,
        testPhotoStore,
        record,
      )
      expect(warnMsg.startsWith('Inconsistent data error')).toBeTruthy()
      const result = await testObsStore.getItem('123A')
      const photos = result.wowMeta[cc.photosToAddFieldName]
      expect(photos.map((e) => e.id)).toEqual(['1234'])
      expect(photos[0].file.data.byteLength).toEqual(byteLengthOfThumbnail)
      const photoDbId = photos[0].id
      const photoRecord = await testPhotoStore.getItem(photoDbId)
      expect(photoRecord).toEqual({
        file: {
          data: expect.any(ArrayBuffer),
          mime: 'image/jpeg',
        },
        id: photoDbId,
        type: 'top',
      })
      expect(photoRecord.file.data.byteLength).toEqual(
        sizeOfPhotoWithExifThumbnail,
      )
    })

    it('should handle a photo with EXIF but no thumbnail', async () => {
      const newPhoto = {
        file: getPhotoNoThumbnail(),
        id: '1234',
        type: 'top',
      }
      const record = {
        uuid: '123A',
        photos: [newPhoto],
        wowMeta: {
          [cc.photosToAddFieldName]: [newPhoto],
        },
      }
      const warnHandler = jest.fn()
      objectUnderTest.registerWarnHandler(warnHandler)
      await objectUnderTest._testonly.storeRecordImpl(
        testObsStore,
        testPhotoStore,
        record,
      )
      expect(warnHandler.mock.calls.length).toBe(1)
      const result = await testObsStore.getItem('123A')
      const photos = result.wowMeta[cc.photosToAddFieldName]
      expect(photos.map((e) => e.id)).toEqual(['1234'])
      expect(photos[0].file).toBeNull()
      const photoDbId = photos[0].id
      const photoRecord = await testPhotoStore.getItem(photoDbId)
      expect(photoRecord).toEqual({
        file: {
          data: expect.any(ArrayBuffer),
          mime: 'image/jpeg',
        },
        id: photoDbId,
        type: 'top',
      })
      expect(photoRecord.file.data.byteLength).toEqual(
        sizeOfPhotoWithExifNoThumbnail,
      )
    })

    it('should handle a photo with no EXIF', async () => {
      const newPhoto = {
        file: getPhotoNoExif(),
        id: '1234',
        type: 'top',
      }
      const record = {
        uuid: '123A',
        photos: [newPhoto],
        wowMeta: {
          [cc.photosToAddFieldName]: [newPhoto],
        },
      }
      const warnHandler = jest.fn()
      objectUnderTest.registerWarnHandler(warnHandler)
      await objectUnderTest._testonly.storeRecordImpl(
        testObsStore,
        testPhotoStore,
        record,
      )
      expect(warnHandler.mock.calls.length).toBe(1)
      const result = await testObsStore.getItem('123A')
      const photos = result.wowMeta[cc.photosToAddFieldName]
      expect(photos.map((e) => e.id)).toEqual(['1234'])
      expect(photos[0].file).toBeNull()
      const photoDbId = photos[0].id
      const photoRecord = await testPhotoStore.getItem(photoDbId)
      expect(photoRecord).toEqual({
        file: {
          data: expect.any(ArrayBuffer),
          mime: 'image/jpeg',
        },
        id: photoDbId,
        type: 'top',
      })
      expect(photoRecord.file.data.byteLength).toEqual(sizeOfPhotoNoExif)
    })

    it('should handle saving an observation that has a photo missing a thumbnail', async () => {
      const alreadyThumbnailed = {
        file: null, // but the photo had no thumbnail
        id: '1234',
        type: 'top',
      }
      const record = {
        uuid: '123A',
        photos: [alreadyThumbnailed],
        wowMeta: {
          [cc.photosToAddFieldName]: [alreadyThumbnailed],
        },
      }
      const warnHandler = jest.fn()
      objectUnderTest.registerWarnHandler(warnHandler)
      await objectUnderTest._testonly.storeRecordImpl(
        testObsStore,
        testPhotoStore,
        record,
      )
      expect(warnHandler.mock.calls.length).toBe(0)
      const result = await testObsStore.getItem('123A')
      const photos = result.wowMeta[cc.photosToAddFieldName]
      expect(photos.map((e) => e.id)).toEqual(['1234'])
      expect(photos[0].file).toBeNull()
    })

    it('should delete a local photo', async () => {
      const recordId = '123A'
      const photoId = '1234'
      const savedRecord = await getRecordWithExistingPhoto(
        testObsStore,
        testPhotoStore,
        recordId,
        photoId,
      )
      // make sure the photo was saved
      const someRemotePhotoId = 9999 // iNat IDs are numbers
      const photoDbId = savedRecord.wowMeta[cc.photosToAddFieldName][0].id
      expect(await testPhotoStore.getItem(photoDbId)).toBeTruthy()
      // now we simulate a record edit that deletes a photo
      const editedRecord = {
        ...savedRecord,
        photos: [],
        wowMeta: {
          ...savedRecord.wowMeta,
          [cc.photoIdsToDeleteFieldName]: [photoDbId, someRemotePhotoId],
          [cc.photosToAddFieldName]: [],
        },
      }
      await objectUnderTest._testonly.storeRecordImpl(
        testObsStore,
        testPhotoStore,
        editedRecord,
      )
      // make sure the photo is gone
      const savedEditedRecord = await testObsStore.getItem(recordId)
      expect(savedEditedRecord.wowMeta[cc.photosToAddFieldName].length).toEqual(
        0,
      )
      expect(savedEditedRecord.wowMeta[cc.photoIdsToDeleteFieldName]).toEqual([
        someRemotePhotoId,
      ])
      expect(await testPhotoStore.getItem(photoDbId)).toBeNull()
    })

    it('should delete all linked photos when an obs is deleted', async () => {
      const recordId = '666B'
      // set up fixture
      const photo1 = {
        file: getPhotoWithThumbnail(),
        id: '1111',
        type: 'top',
      }
      const photo2 = {
        file: getPhotoWithThumbnail(),
        id: '2222',
        type: 'flower',
      }
      const record = {
        uuid: recordId,
        photos: [photo1, photo2],
        wowMeta: {
          [cc.photosToAddFieldName]: [photo1, photo2],
        },
      }
      await objectUnderTest._testonly.storeRecordImpl(
        testObsStore,
        testPhotoStore,
        record,
      )
      const savedRecord = await testObsStore.getItem(recordId)
      // confirm the obs and photos were saved
      expect(savedRecord).toBeTruthy()
      for (const curr of savedRecord.photos) {
        expect(await testPhotoStore.getItem(curr.id)).toBeTruthy()
      }
      // now we delete the obs record
      await objectUnderTest._testonly.deleteDbRecordByIdImpl(
        testObsStore,
        testPhotoStore,
        recordId,
      )
      expect(await testObsStore.getItem(recordId)).toBeNull()
      for (const curr of savedRecord.photos) {
        expect(await testPhotoStore.getItem(curr.id)).toBeNull()
      }
    })

    it('should only thumbnail-ify any given photo once', async () => {
      const recordId = '456A'
      const photoId = '1234'
      const savedRecord = await getRecordWithExistingPhoto(
        testObsStore,
        testPhotoStore,
        recordId,
        photoId,
      )
      // now we simulate a record edit that adds a photo
      const newPhoto = {
        file: getPhotoWithThumbnail(),
        id: '5678',
        type: 'flower',
      }
      const editedRecord = {
        ...savedRecord,
        photos: [...savedRecord.photos, newPhoto],
        wowMeta: {
          ...savedRecord.wowMeta,
          [cc.photosToAddFieldName]: [
            ...savedRecord.wowMeta[cc.photosToAddFieldName],
            newPhoto,
          ],
        },
      }
      await objectUnderTest._testonly.storeRecordImpl(
        testObsStore,
        testPhotoStore,
        editedRecord,
      )
      const result = await testObsStore.getItem(recordId)
      const photos = result.wowMeta[cc.photosToAddFieldName]
      expect(photos.map((e) => e.id)).toEqual([photoId, '5678'])
      expect(photos[0].file.data.byteLength).toEqual(byteLengthOfThumbnail)
      expect(photos[1].file.data.byteLength).toEqual(byteLengthOfThumbnail)
      const firstPhotoDbId = photos[0].id
      const firstPhotoRecord = await testPhotoStore.getItem(firstPhotoDbId)
      expect(firstPhotoRecord).toEqual({
        file: {
          data: expect.any(ArrayBuffer),
          mime: 'image/jpeg',
        },
        id: firstPhotoDbId,
        type: 'top',
      })
      expect(firstPhotoRecord.file.data.byteLength).toEqual(
        sizeOfPhotoWithExifThumbnail,
      )
      const secondPhotoDbId = photos[1].id
      const secondPhotoRecord = await testPhotoStore.getItem(secondPhotoDbId)
      expect(secondPhotoRecord).toEqual({
        file: {
          data: expect.any(ArrayBuffer),
          mime: 'image/jpeg',
        },
        id: secondPhotoDbId,
        type: 'flower',
      })
      expect(secondPhotoRecord.file.data.byteLength).toEqual(
        sizeOfPhotoWithExifThumbnail,
      )
    })

    it('should throw an error when we pass a record without a key', async () => {
      const record = {
        // no 'uuid' set
      }
      try {
        await objectUnderTest._testonly.storeRecordImpl(
          testObsStore,
          testPhotoStore,
          record,
        )
      } catch (err) {
        if (err.message.startsWith('Failed to store db record')) {
          return
        }
      }
      throw new Error('Fail! expected a thrown error')
    })
  })

  // FIXME test migration code for this new facade work

  describe('migrateLocalRecordsWithoutOutcomeLastUpdatedAt', () => {
    it('should migrate a non-migrated obs record', async () => {
      const recordId = '92818C'
      // set up fixture
      const record = {
        uuid: recordId,
        photos: [],
        wowMeta: {
          [cc.photosToAddFieldName]: [],
        },
      }
      await testObsStore.setItem(recordId, record)
      // now we do the migration
      const migratedIds =
        await objectUnderTest._testonly.migrateLocalRecordsWithoutOutcomeLastUpdatedAt(
          testObsStore,
          testPhotoStore,
          testMetaStore,
        )
      expect(migratedIds[0]).toEqual(recordId)
      const migratedRecord = await testObsStore.getItem(recordId)
      expect(
        migratedRecord.wowMeta[cc.outcomeLastUpdatedAtFieldName],
      ).toBeTruthy()
    })

    it('should not migrate a migrated obs record', async () => {
      const recordId = '228836'
      // set up fixture
      const record = {
        uuid: recordId,
        photos: [],
        wowMeta: {
          [cc.photosToAddFieldName]: [],
          [cc.outcomeLastUpdatedAtFieldName]: new Date().toString(),
        },
      }
      await testObsStore.setItem(recordId, record)
      // now we do the migration
      const migratedIds =
        await objectUnderTest._testonly.migrateLocalRecordsWithoutOutcomeLastUpdatedAt(
          testObsStore,
          testPhotoStore,
          testMetaStore,
        )
      expect(migratedIds.length).toEqual(0)
    })

    it(`should not migrate when it's already been done`, async () => {
      await testMetaStore.setItem(
        cc.noOutcomeLastUpdatedMigrationKey,
        new Date().toISOString(),
      )
      const migratedIds =
        await objectUnderTest._testonly.migrateLocalRecordsWithoutOutcomeLastUpdatedAt(
          {
            keys: async () => {
              throw new Error('Should not be called')
            },
          },
          null,
          testMetaStore,
        )
      expect(migratedIds.length).toEqual(0)
    })
  })

  describe('getRecord', () => {
    it('should get an existing record', async () => {
      await testObsStore.setItem('123A', {
        uuid: '123A',
        foo: 'bar',
      })
      const result = await objectUnderTest._testonly.getRecordImpl(
        testObsStore,
        '123A',
      )
      expect(result.foo).toEqual('bar')
    })

    it('should not throw an error when we request a non-existant record', async () => {
      const result = await objectUnderTest._testonly.getRecordImpl(
        testObsStore,
        'NOTHING-WITH-THIS-KEY',
      )
      expect(result).toBeNull()
    })

    it('should handle a store error', async () => {
      const store = {
        getItem() {
          throw new Error('BANG')
        },
      }
      try {
        await objectUnderTest._testonly.getRecordImpl(store, 'SOME-KEY')
      } catch (err) {
        if (err.message.startsWith('Failed to get DB record')) {
          return
        }
      }
      throw new Error('Fail! expected a thrown error')
    })
  })
})

async function getRecordWithExistingPhoto(
  obsStore,
  photoStore,
  recordId,
  photoId,
) {
  const existingPhoto = {
    file: getPhotoWithThumbnail(),
    id: photoId,
    type: 'top',
  }
  const record = {
    uuid: recordId,
    photos: [existingPhoto],
    wowMeta: {
      [cc.photosToAddFieldName]: [existingPhoto],
    },
  }
  await objectUnderTest._testonly.storeRecordImpl(obsStore, photoStore, record)
  return objectUnderTest._testonly.getRecordImpl(obsStore, recordId)
}
