import * as objectUnderTest from '@/misc/helpers'

describe('makeEnumValidator', () => {
  it('should handle valid enum array and valid input to Fn', () => {
    const fooStatuses = ['aaa', 'bbb', 'ccc']
    const fooStatus = objectUnderTest.makeEnumValidator(fooStatuses)
    const result = fooStatus('aaa')
    expect(result).toEqual('aaa')
  })

  it('should explode for valid enum array and INvalid input to Fn', () => {
    const fooStatuses = ['aaa', 'bbb', 'ccc']
    const fooStatus = objectUnderTest.makeEnumValidator(fooStatuses)
    try {
      fooStatus('notvalid')
      fail('should throw error as input is not valid in the "enum"')
    } catch (err) {
      // success
    }
  })

  it('should explode with an empty array', () => {
    try {
      objectUnderTest.makeEnumValidator([])
      fail('error should be thrown')
    } catch (err) {
      // success
    }
  })

  it('should explode with a non-array input', () => {
    try {
      objectUnderTest.makeEnumValidator({ ka: 'boom' })
      fail('error should be thrown')
    } catch (err) {
      // success
    }
  })
})

describe('chainedError', () => {
  it('should handle no error passed in', () => {
    const err = null
    const result = objectUnderTest.chainedError('some msg', err)
    expect(result.message).toEqual(
      expect.stringMatching(/some msg\nWARNING:.*/),
    )
  })

  it('should handle an error object passed in', () => {
    const err = new Error('some cause')
    const result = objectUnderTest.chainedError('some caller', err)
    expect(result.message).toEqual(
      expect.stringMatching(/some caller\nCaused by: some cause/),
    )
  })

  it('should handle an error string passed in', () => {
    const err = 'some cause string'
    const result = objectUnderTest.chainedError('some caller', err)
    expect(result.message).toEqual(
      expect.stringMatching(/some caller\nCaused by: some cause string/),
    )
  })

  it('should handle an error with readonly message', () => {
    const err = new Error()
    const origConsoleWarn = console.warn
    console.warn = () => {}
    Object.defineProperty(err, 'message', {
      value: 'some readonly msg',
      writable: false,
    })
    const result = objectUnderTest.chainedError('some caller', err)
    expect(result.message).toEqual(
      expect.stringMatching(/some caller\nCaused by: some readonly msg/),
    )
    console.warn = origConsoleWarn
  })
})

describe('formatMetricDistance', () => {
  it('should handle less than 1 km', () => {
    const result = objectUnderTest.formatMetricDistance(123)
    expect(result).toEqual('123m')
  })

  it('should handle fractions of a meter', () => {
    const result = objectUnderTest.formatMetricDistance(123.456789)
    expect(result).toEqual('123m')
  })

  it('should handle greater than 1 km', () => {
    const result = objectUnderTest.formatMetricDistance(8323)
    expect(result).toEqual('8.3km')
  })

  it('should handle 0', () => {
    const result = objectUnderTest.formatMetricDistance(0)
    expect(result).toEqual(0)
  })

  it('should handle falsy', () => {
    const result = objectUnderTest.formatMetricDistance(null)
    expect(result).toBeNull()
  })
})

describe('isRespJson', () => {
  it('should handle a basic application/json', () => {
    const resp = mockResp('application/json')
    const result = objectUnderTest._testonly.isRespJson(resp)
    expect(result).toEqual(true)
  })

  it('should handle a charset', () => {
    const resp = mockResp('application/json; charset=utf-8')
    const result = objectUnderTest._testonly.isRespJson(resp)
    expect(result).toEqual(true)
  })

  it('should handle a short vendor tree extension', () => {
    const resp = mockResp('application/vnd.example+json')
    const result = objectUnderTest._testonly.isRespJson(resp)
    expect(result).toEqual(true)
  })

  it('should handle a longer vendor tree extension', () => {
    const resp = mockResp('application/vnd.example.blah.something+json')
    const result = objectUnderTest._testonly.isRespJson(resp)
    expect(result).toEqual(true)
  })

  it('should consider html as false', () => {
    const resp = mockResp('text/html')
    const result = objectUnderTest._testonly.isRespJson(resp)
    expect(result).toEqual(false)
  })

  it('should handle an empty string', () => {
    const resp = mockResp('')
    const result = objectUnderTest._testonly.isRespJson(resp)
    expect(result).toEqual(false)
  })

  it('should handle a null', () => {
    const resp = mockResp(null)
    const result = objectUnderTest._testonly.isRespJson(resp)
    expect(result).toEqual(false)
  })
})

describe('verifyWowDomainPhoto', () => {
  it('should pass a valid record', () => {
    const record = {
      id: 1,
      url: 'http://blah',
      licenseCode: 'cc-by-nc',
      attribution: '(c) user, some rights reserved (CC BY-NC)',
    }
    objectUnderTest.verifyWowDomainPhoto(record)
    // expect nothing is thrown
  })

  it('should fail a record missing an ID', () => {
    const record = {
      // no 'id'
      url: 'http://blah',
      licenseCode: 'cc-by-nc',
      attribution: '(c) user, some rights reserved (CC BY-NC)',
    }
    try {
      objectUnderTest.verifyWowDomainPhoto(record)
      fail('error should have been thrown')
    } catch (err) {
      // success
    }
  })

  it('should fail a record missing a URL', () => {
    const record = {
      id: 33,
      // no URL
      licenseCode: 'cc-by-nc',
      attribution: '(c) user, some rights reserved (CC BY-NC)',
    }
    try {
      objectUnderTest.verifyWowDomainPhoto(record)
      fail('error should have been thrown')
    } catch (err) {
      // success
    }
  })

  it('should fail a record missing a license code', () => {
    const record = {
      id: 33,
      url: 'http://some.ph/oto.jpg',
      // no licenseCode
      attribution: '(c) user, some rights reserved (CC BY-NC)',
    }
    try {
      objectUnderTest.verifyWowDomainPhoto(record)
      fail('error should have been thrown')
    } catch (err) {
      // success
    }
  })

  it('should fail a record missing an attribution', () => {
    const record = {
      id: 33,
      url: 'http://some.ph/oto.jpg',
      licenseCode: 'cc-by-nc',
      // no attribution
    }
    try {
      objectUnderTest.verifyWowDomainPhoto(record)
      fail('error should have been thrown')
    } catch (err) {
      // success
    }
  })
})

describe('buildUrlSuffix', () => {
  it('should build a URL with no params', () => {
    const result = objectUnderTest.buildUrlSuffix('/blah')
    expect(result).toEqual('/blah')
  })

  it('should build a URL with empty params', () => {
    const result = objectUnderTest.buildUrlSuffix('/blah', {})
    expect(result).toEqual('/blah')
  })

  it('should build a URL with one param', () => {
    const result = objectUnderTest.buildUrlSuffix('/blah', {
      foo: 'bar',
    })
    expect(result).toEqual('/blah?foo=bar')
  })

  it('should build a URL with params', () => {
    const result = objectUnderTest.buildUrlSuffix('/blah', {
      foo: 'bar',
      baz: 123,
    })
    expect(result).toEqual('/blah?foo=bar&baz=123')
  })

  it('should exclude params that are null-ish', () => {
    const result = objectUnderTest.buildUrlSuffix('/blah', {
      foo: 'bar',
      baz: null,
      something: undefined,
    })
    expect(result).toEqual('/blah?foo=bar')
  })
})

describe('formatStorageSize', () => {
  it('should handle a size smaller than 1MB', () => {
    const oneByte = 1
    const result = objectUnderTest.formatStorageSize(oneByte)
    expect(result).toEqual('less than 1MB')
  })

  it('should handle a size between 1 and 10MB', () => {
    const fourPointThreeMb = 4.34567 * 1000 * 1000
    const result = objectUnderTest.formatStorageSize(fourPointThreeMb)
    expect(result).toEqual('4.3MB')
  })

  it('should handle a size greater than 10MB', () => {
    const fiftyFiveMb = 55.187123 * 1000 * 1000
    const result = objectUnderTest.formatStorageSize(fiftyFiveMb)
    expect(result).toEqual('55MB')
  })

  it('should handle a size greater than 1GB', () => {
    const oneGb = 1.23 * 1000 * 1000 * 1000
    const result = objectUnderTest.formatStorageSize(oneGb)
    expect(result).toEqual('1.2GB')
  })

  it('should round correctly', () => {
    const result = objectUnderTest.formatStorageSize(33.87123 * 1000 * 1000)
    expect(result).toEqual('34MB')
  })

  it('should handle zero', () => {
    const noBytes = 0
    const result = objectUnderTest.formatStorageSize(noBytes)
    expect(result).toEqual('nothing')
  })
})

describe('approxAreaSearchValueToTitle', () => {
  it('should handle 1', () => {
    const result = objectUnderTest.approxAreaSearchValueToTitle(1)
    expect(result).toEqual('1x1 (1m²)')
  })

  it('should handle a number, that is a sqaure, that is larger than 1', () => {
    const result = objectUnderTest.approxAreaSearchValueToTitle(25)
    expect(result).toEqual('5x5 (25m²)')
  })

  it('should handle a stringy number', () => {
    const result = objectUnderTest.approxAreaSearchValueToTitle('36')
    expect(result).toEqual('6x6 (36m²)')
  })

  it('should handle a non-number input', () => {
    const result = objectUnderTest.approxAreaSearchValueToTitle('>100')
    expect(result).toEqual('>100')
  })
})

describe('buildStaleCheckerFn', () => {
  it('should consider no timestamp as stale', () => {
    const state = { blahLastUpdated: null }
    const fnUnderTest = objectUnderTest.buildStaleCheckerFn(
      'blahLastUpdated',
      10,
    )
    const isStale = fnUnderTest(state)
    expect(isStale).toEqual(true)
  })

  it('should consider being before the threshold as NOT stale', () => {
    const staleMinutes = 10
    const state = { blahLastUpdated: 100000 }
    const fnUnderTest = objectUnderTest.buildStaleCheckerFn(
      'blahLastUpdated',
      staleMinutes,
      () => timeEarlierThanThreshold,
    )
    const halfStaleMinutes = staleMinutes / 2
    const timeEarlierThanThreshold =
      state.blahLastUpdated + halfStaleMinutes * 60 * 1000
    const isStale = fnUnderTest(state)
    expect(isStale).toEqual(false)
  })

  it('should consider being equal to the threshold as NOT stale', () => {
    const staleMinutes = 10
    const state = { blahLastUpdated: 100000 }
    const fnUnderTest = objectUnderTest.buildStaleCheckerFn(
      'blahLastUpdated',
      staleMinutes,
      () => timeLaterThanThreshold,
    )
    const timeLaterThanThreshold =
      state.blahLastUpdated + staleMinutes * 60 * 1000
    const isStale = fnUnderTest(state)
    expect(isStale).toEqual(false)
  })

  it('should consider being after the threshold as stale', () => {
    const staleMinutes = 10
    const state = { blahLastUpdated: 100000 }
    const fnUnderTest = objectUnderTest.buildStaleCheckerFn(
      'blahLastUpdated',
      staleMinutes,
      () => timeLaterThanThreshold,
    )
    const doubleStaleMinutes = staleMinutes * 2
    const timeLaterThanThreshold =
      state.blahLastUpdated + doubleStaleMinutes * 2 * 60 * 1000
    const isStale = fnUnderTest(state)
    expect(isStale).toEqual(true)
  })
})

function mockResp(mimeStr) {
  return {
    headers: {
      get: () => mimeStr,
    },
  }
}
