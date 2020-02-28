import { _testonly } from '@/misc/safari-blob-patch'

describe('ArrayBufferPolyfill', () => {
  it('should convert a Blob to ArrayBuffer', async () => {
    const buffer = new Uint8Array([1, 2, 3, 4])
    const blob = new Blob(buffer)
    const bound = _testonly.ArrayBufferPolyfill.bind(blob)
    const result = await bound()
    expect(result.byteLength).toEqual(4)
  })
})
