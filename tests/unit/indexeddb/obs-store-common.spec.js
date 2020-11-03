import {
  _testonly as objectUnderTest,
  registerWarnHandler,
} from '@/indexeddb/obs-store-common'
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

describe('obs-store-common', () => {
  let origConsoleDebug
  const testObsStore = getOrCreateInstance('test-store')
  const testPhotoStore = getOrCreateInstance('test-photo-store')

  beforeAll(function() {
    origConsoleDebug = console.debug
    console.debug = () => {}
  })

  beforeEach(async () => {
    await testObsStore.clear()
    await testPhotoStore.clear()
  })

  afterAll(async () => {
    console.debug = origConsoleDebug
    await testObsStore.clear()
    await testPhotoStore.clear()
  })

  describe('storeRecord', () => {
    it('should store a valid record, without photos', async () => {
      const record = {
        uuid: '123A',
        foo: 'bar',
      }
      await objectUnderTest.storeRecordImpl(
        testObsStore,
        testPhotoStore,
        record,
      )
      const result = await testObsStore.getItem('123A')
      expect(result.foo).toEqual('bar')
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
      await objectUnderTest.storeRecordImpl(
        testObsStore,
        testPhotoStore,
        record,
      )
      const result = await testObsStore.getItem('123A')
      const photos = result.wowMeta[cc.photosToAddFieldName]
      expect(photos.map(e => e.id)).toEqual(['1234'])
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
      registerWarnHandler(warnHandler)
      await objectUnderTest.storeRecordImpl(
        testObsStore,
        testPhotoStore,
        record,
      )
      expect(warnHandler.mock.calls.length).toBe(1)
      const result = await testObsStore.getItem('123A')
      const photos = result.wowMeta[cc.photosToAddFieldName]
      expect(photos.map(e => e.id)).toEqual(['1234'])
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
      registerWarnHandler(warnHandler)
      await objectUnderTest.storeRecordImpl(
        testObsStore,
        testPhotoStore,
        record,
      )
      expect(warnHandler.mock.calls.length).toBe(1)
      const result = await testObsStore.getItem('123A')
      const photos = result.wowMeta[cc.photosToAddFieldName]
      expect(photos.map(e => e.id)).toEqual(['1234'])
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
      registerWarnHandler(warnHandler)
      await objectUnderTest.storeRecordImpl(
        testObsStore,
        testPhotoStore,
        record,
      )
      expect(warnHandler.mock.calls.length).toBe(0)
      const result = await testObsStore.getItem('123A')
      const photos = result.wowMeta[cc.photosToAddFieldName]
      expect(photos.map(e => e.id)).toEqual(['1234'])
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
      await objectUnderTest.storeRecordImpl(
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

    it('should delete a blocked photo', async () => {
      const recordId = '456A'
      const photoId = '3334'
      const savedRecord = await getRecordWithExistingBlockedPhoto(
        testObsStore,
        testPhotoStore,
        recordId,
        photoId,
      )
      // make sure the photo was saved
      const someRemotePhotoId = 8181 // iNat IDs are numbers
      const photoDbId =
        savedRecord.wowMeta[cc.blockedActionFieldName].wowMeta[
          cc.photosToAddFieldName
        ][0].id
      expect(await testPhotoStore.getItem(photoDbId)).toBeTruthy()
      // now we simulate a record edit that deletes a photo
      const editedRecord = {
        ...savedRecord,
        photos: [],
        wowMeta: {
          ...savedRecord.wowMeta,
          [cc.blockedActionFieldName]: {
            wowMeta: {
              [cc.photoIdsToDeleteFieldName]: [photoDbId, someRemotePhotoId],
              [cc.photosToAddFieldName]: [],
            },
          },
        },
      }
      await objectUnderTest.storeRecordImpl(
        testObsStore,
        testPhotoStore,
        editedRecord,
      )
      // make sure the photo is gone
      const savedEditedRecord = await testObsStore.getItem(recordId)
      expect(
        savedEditedRecord.wowMeta[cc.blockedActionFieldName].wowMeta[
          cc.photosToAddFieldName
        ].length,
      ).toEqual(0)
      expect(
        savedEditedRecord.wowMeta[cc.blockedActionFieldName].wowMeta[
          cc.photoIdsToDeleteFieldName
        ],
      ).toEqual([someRemotePhotoId])
      expect(await testPhotoStore.getItem(photoDbId)).toBeNull()
    })

    // FIXME handle record delete that also deletes photos

    // FIXME handle implicit photo delete on obs record clobber

    // FIXME handle migration to move existing photos to separate storage

    it('should only thumbnail-ify any given photo once', async () => {
      const recordId = '123A'
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
      await objectUnderTest.storeRecordImpl(
        testObsStore,
        testPhotoStore,
        editedRecord,
      )
      const result = await testObsStore.getItem(recordId)
      const photos = result.wowMeta[cc.photosToAddFieldName]
      expect(photos.map(e => e.id)).toEqual([photoId, '5678'])
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

    it('should only thumbnail-ify any given photo once for blocked photos', async () => {
      const recordId = '456A'
      const photoId = '1234'
      const savedRecord = await getRecordWithExistingBlockedPhoto(
        testObsStore,
        testPhotoStore,
        recordId,
        photoId,
      )
      // now we simulate a record edit that adds a photo to the blocked action
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
          [cc.blockedActionFieldName]: {
            wowMeta: {
              [cc.photosToAddFieldName]: [
                ...savedRecord.wowMeta[cc.blockedActionFieldName].wowMeta[
                  cc.photosToAddFieldName
                ],
                newPhoto,
              ],
            },
          },
        },
      }
      await objectUnderTest.storeRecordImpl(
        testObsStore,
        testPhotoStore,
        editedRecord,
      )
      const result = await testObsStore.getItem(recordId)
      const photos =
        result.wowMeta[cc.blockedActionFieldName].wowMeta[
          cc.photosToAddFieldName
        ]
      expect(photos.map(e => e.id)).toEqual([photoId, '5678'])
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
        await objectUnderTest.storeRecordImpl(
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

  describe('getRecord', () => {
    it('should get an existing record', async () => {
      await testObsStore.setItem('123A', {
        uuid: '123A',
        foo: 'bar',
      })
      const result = await objectUnderTest.getRecordImpl(testObsStore, '123A')
      expect(result.foo).toEqual('bar')
    })

    it('should not throw an error when we request a non-existant record', async () => {
      const result = await objectUnderTest.getRecordImpl(
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
        await objectUnderTest.getRecordImpl(store, 'SOME-KEY')
      } catch (err) {
        if (err.message.startsWith('Failed to get db record')) {
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
  await objectUnderTest.storeRecordImpl(obsStore, photoStore, record)
  return objectUnderTest.getRecordImpl(obsStore, recordId)
}

async function getRecordWithExistingBlockedPhoto(
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
      [cc.blockedActionFieldName]: {
        wowMeta: {
          [cc.photosToAddFieldName]: [existingPhoto],
        },
      },
    },
  }
  await objectUnderTest.storeRecordImpl(obsStore, photoStore, record)
  return objectUnderTest.getRecordImpl(obsStore, recordId)
}
