import { _testonly as objectUnderTest } from '@/../sw-src/sw'

describe('isSafeToProcessQueue', () => {
  let origConsoleDebug

  beforeAll(function() {
    origConsoleDebug = console.debug
    console.debug = () => {}
  })

  afterAll(function() {
    console.debug = origConsoleDebug
  })

  it('should be false when no auth header is set', async () => {
    objectUnderTest.setAuthHeader(null)
    const result = objectUnderTest.isSafeToProcessQueue()
    expect(result).toEqual(false)
  })

  it('should be true when auth header IS set', async () => {
    objectUnderTest.setAuthHeader('eySomeToken')
    const result = objectUnderTest.isSafeToProcessQueue()
    expect(result).toEqual(true)
  })
})
