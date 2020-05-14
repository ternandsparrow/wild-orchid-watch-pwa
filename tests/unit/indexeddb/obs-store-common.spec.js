import { _testonly as objectUnderTest } from '@/indexeddb/obs-store-common'
import { getOrCreateInstance } from '@/indexeddb/storage-manager'

describe('obs-store-common', () => {
  const testStore = getOrCreateInstance('test-store')

  beforeEach(async () => {
    await testStore.clear()
  })

  describe('storeRecord', () => {
    it('should store a valid record', async () => {
      const record = {
        uuid: '123A',
        foo: 'bar',
      }
      await objectUnderTest.storeRecordImpl(testStore, record)
      const result = await testStore.getItem('123A')
      expect(result.foo).toEqual('bar')
    })

    it('should throw an error when we pass a record without a key', async () => {
      const record = {
        // no 'uuid' set
      }
      try {
        await objectUnderTest.storeRecordImpl(testStore, record)
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
      testStore.setItem('123A', {
        uuid: '123A',
        foo: 'bar',
      })
      const result = await objectUnderTest.getRecordImpl(testStore, '123A')
      expect(result.foo).toEqual('bar')
    })

    it('should not throw an error when we request a non-existant record', async () => {
      const result = await objectUnderTest.getRecordImpl(
        testStore,
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
