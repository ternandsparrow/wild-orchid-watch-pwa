import { getOrCreateInstance } from '@/indexeddb/storage-manager'

describe('snapshot of object', () => {
  const testStore = getOrCreateInstance('test-store')

  beforeEach(async () => {
    await testStore.clear()
  })

  it('should not modify the snapshot from getItem when setItem is called', async () => {
    await testStore.setItem('obj1', {
      foo: 'bar',
    })
    const result = await testStore.getItem('obj1')
    await testStore.setItem('obj1', {
      foo: 'changed!',
    })
    expect(result.foo).toEqual('bar')
  })
})
