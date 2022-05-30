import dayjs from 'dayjs'
import * as objectUnderTest from '@/misc/helpers'

beforeEach(function () {
  global.fetch = undefined
})

describe('doManagedFetch', () => {
  it('should handle a successful req for JSON', async () => {
    global.fetch = async () =>
      cloneableResp({
        ok: true,
        headers: {
          get(key) {
            const fakeHeaders = {
              'Content-Type': 'application/json',
            }
            return fakeHeaders[key]
          },
        },
        json: () => 'match me!',
      })
    const result = await objectUnderTest._testonly.doManagedFetch('/test', {})
    expect(result).toEqual('match me!')
  })

  it('should handle a NOT successful req for JSON', async () => {
    global.fetch = async () =>
      cloneableResp({
        ok: false,
        headers: {
          get(key) {
            const fakeHeaders = {
              'Content-Type': 'application/json',
            }
            return fakeHeaders[key]
          },
        },
        json: () => 'match me!',
      })
    await expect(
      objectUnderTest._testonly.doManagedFetch('/test', {}),
    ).rejects.toThrow('Response is either not OK or not JSON')
  })

  it('should handle a successful req that is NOT JSON', async () => {
    global.fetch = async () =>
      cloneableResp({
        ok: true,
        headers: {
          get(key) {
            const fakeHeaders = {
              'Content-Type': 'text/html',
            }
            return fakeHeaders[key]
          },
        },
        text: () => '<html>...',
      })
    await expect(
      objectUnderTest._testonly.doManagedFetch('/test', {}),
    ).rejects.toThrow('Response is either not OK or not JSON')
  })

  it('should handle a JSON parsing error', async () => {
    global.fetch = async () =>
      cloneableResp({
        ok: true,
        headers: {
          get(key) {
            const fakeHeaders = {
              'Content-Type': 'application/json',
            }
            return fakeHeaders[key]
          },
        },
        json() {
          return JSON.parse('<html>not JSON</html>')
        },
        text: () => '<html>not JSON</html>',
      })
    await expect(
      objectUnderTest._testonly.doManagedFetch('/test', {}),
    ).rejects.toThrow('Failed while parsing JSON response')
  })

  it('should handle an "also ok" HTTP status code', async () => {
    global.fetch = async () =>
      cloneableResp({
        ok: false,
        status: 201,
        headers: {
          get(key) {
            const fakeHeaders = {
              'Content-Type': 'application/json',
            }
            return fakeHeaders[key]
          },
        },
        json() {
          return 'success!'
        },
      })
    const result = await objectUnderTest._testonly.doManagedFetch('/test', {}, [
      201,
    ])
    expect(result).toBe('success!')
  })

  it('should downgrade a fetch error to a warning for a known message', async () => {
    global.fetch = async () => {
      throw new Error('Failed to fetch: The network connection was lost')
    }
    try {
      await objectUnderTest._testonly.doManagedFetch('/test', {})
    } catch (err) {
      expect(err.isDowngradable).toBe(true)
      return
    }
    throw new Error('Fail, expected to throw!')
  })
})

describe('findCommonString', () => {
  it('should find a common string when there is one', () => {
    const string1 =
      'WOW Phenology - life stage status occurring - Senescent fruit'
    const string2 = 'WOW Phenology - life stage status occurring - Flowering'
    const result = objectUnderTest.findCommonString(string1, string2)
    expect(result).toEqual('WOW Phenology - life stage status occurring - ')
  })

  it('should handle when string1 is shorter', () => {
    const string1 = 'WOW Phenology - life stage status occurring - Flowering'
    const string2 =
      'WOW Phenology - life stage status occurring - Senescent fruit'
    const result = objectUnderTest.findCommonString(string1, string2)
    expect(result).toEqual('WOW Phenology - life stage status occurring - ')
  })

  it('should avoid cutting off part of a word', () => {
    const string1 = 'WOW Foo - Cars'
    const string2 = 'WOW Foo - Cats'
    const result = objectUnderTest.findCommonString(string1, string2)
    expect(result).toEqual('WOW Foo - ')
  })
})

describe('isInBoundingBoxImpl', () => {
  const bboxPartial = {
    minLat: -43.1234,
    maxLat: -10.1234,
    minLon: 113.1234,
    maxLon: 153.1234,
  }

  it('should handle coords *in* the box', () => {
    const result = objectUnderTest._testonly.isInBoundingBoxImpl({
      ...bboxPartial,
      userLat: -22.1234,
      userLon: 120.1234,
    })
    expect(result).toEqual(true)
  })

  it('should handle other coords *in* the box', () => {
    const result = objectUnderTest._testonly.isInBoundingBoxImpl({
      ...bboxPartial,
      userLat: -35.156095,
      userLon: 138.54721833333332,
    })
    expect(result).toEqual(true)
  })

  it('should handle lat less than min', () => {
    const result = objectUnderTest._testonly.isInBoundingBoxImpl({
      ...bboxPartial,
      userLat: -8.1234,
      userLon: 120.1234,
    })
    expect(result).toEqual(false)
  })

  it('should handle lat greater than max', () => {
    const result = objectUnderTest._testonly.isInBoundingBoxImpl({
      ...bboxPartial,
      userLat: -58.1234,
      userLon: 120.1234,
    })
    expect(result).toEqual(false)
  })

  it('should handle lon less than min', () => {
    const result = objectUnderTest._testonly.isInBoundingBoxImpl({
      ...bboxPartial,
      userLat: -22.1234,
      userLon: 33.1234,
    })
    expect(result).toEqual(false)
  })

  it('should handle lat greater than max', () => {
    const result = objectUnderTest._testonly.isInBoundingBoxImpl({
      ...bboxPartial,
      userLat: -22.1234,
      userLon: 170.1234,
    })
    expect(result).toEqual(false)
  })

  it('should handle falsy input for lat', () => {
    const result = objectUnderTest._testonly.isInBoundingBoxImpl({
      ...bboxPartial,
      userLat: null,
      userLon: 170.1234,
    })
    expect(result).toEqual(false)
  })

  it('should handle falsy input for lon', () => {
    const result = objectUnderTest._testonly.isInBoundingBoxImpl({
      ...bboxPartial,
      userLat: -22,
      userLon: null,
    })
    expect(result).toEqual(false)
  })
})

describe('ChainedError', () => {
  it('should handle no error passed in', () => {
    const err = null
    const result = objectUnderTest.ChainedError('some msg', err)
    expect(result.message).toEqual(
      expect.stringMatching(/some msg\nWARNING:.*/),
    )
  })

  it('should handle an error object passed in', () => {
    const err = new Error('some cause')
    const result = objectUnderTest.ChainedError('some caller', err)
    expect(result.message).toEqual(
      expect.stringMatching(/some caller\nCaused by: some cause/),
    )
  })

  it('should handle an error string passed in', () => {
    const err = 'some cause string'
    const result = objectUnderTest.ChainedError('some caller', err)
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
    const result = objectUnderTest.ChainedError('some caller', err)
    expect(result.message).toEqual(
      expect.stringMatching(/some caller\nCaused by: some readonly msg/),
    )
    console.warn = origConsoleWarn
  })
})

describe('convertExifDateStr', () => {
  it('should handle a common value', () => {
    const result = objectUnderTest.convertExifDateStr('2020:03:15 13:44:23')
    expect(result).toEqual('2020-03-15 13:44:23')
  })

  it('should handle undefined input', () => {
    const result = objectUnderTest.convertExifDateStr(undefined)
    expect(result).toEqual(undefined)
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
    }
    objectUnderTest.verifyWowDomainPhoto(record)
    // expect nothing is thrown
  })

  it('should fail a record missing an ID', () => {
    const record = {
      // no 'id'
      url: 'http://blah',
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

describe('rectangleAlongPathAreaValueToTitle', () => {
  it('should handle value < 1', () => {
    const result =
      objectUnderTest.rectangleAlongPathAreaValueToTitle('less than 1')
    expect(result).toEqual('less than 1m² (i.e. 0.5x0.5 or similar)')
  })

  it('should handle 1 <= value < "fixed side"', () => {
    const result = objectUnderTest.rectangleAlongPathAreaValueToTitle(1)
    expect(result).toEqual('1m² (i.e. 1x1 or similar)')
  })

  it('should handle 2', () => {
    const result = objectUnderTest.rectangleAlongPathAreaValueToTitle(2)
    expect(result).toEqual('2m² (i.e. 1x2 or similar)')
  })

  it('should handle a number that is larger than 1', () => {
    const result = objectUnderTest.rectangleAlongPathAreaValueToTitle(24)
    expect(result).toEqual('24m² (i.e. 12x2 or similar)')
  })

  it('should not explode when we have a number that does not fit nicely', () => {
    const result = objectUnderTest.rectangleAlongPathAreaValueToTitle(33)
    expect(result).toEqual('33m² (i.e. 16.5x2 or similar)')
  })

  it('should handle a stringy number', () => {
    const result = objectUnderTest.rectangleAlongPathAreaValueToTitle('36')
    expect(result).toEqual('36m² (i.e. 18x2 or similar)')
  })

  it('should handle a non-number input', () => {
    const result = objectUnderTest.rectangleAlongPathAreaValueToTitle('>100')
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

describe('Mission body', () => {
  it('should encode all supplied information in a mission body', () => {
    const name = 'some name'
    const endDate = '2020-02-28'
    const goal = 'some goal'
    const result = objectUnderTest.encodeMissionBody(name, endDate, goal)
    const indexOfCodeStartTag = result.indexOf('<code')
    expect(!!~indexOfCodeStartTag).toEqual(true)
    expect(!!~result.indexOf(name, indexOfCodeStartTag)).toEqual(true)
    expect(!!~result.indexOf('startDateRaw":', indexOfCodeStartTag)).toEqual(
      true,
    )
    expect(!!~result.indexOf('endDateRaw":', indexOfCodeStartTag)).toEqual(true)
    expect(!!~result.indexOf(goal, indexOfCodeStartTag)).toEqual(true)
  })

  it('should be able to decode something that was encoded', () => {
    const mockToday = dayjs('2020-02-10')
    const name = 'some name'
    const endDate = '2020-02-28'
    const goal = 'some goal'
    const encoded = objectUnderTest.encodeMissionBody(
      name,
      endDate,
      goal,
      mockToday,
    )
    const result = objectUnderTest.decodeMissionBody(encoded)
    expect(result.name).toEqual(name)
    expect(dayjs(result.startDate).isBefore(dayjs(endDate))).toEqual(true)
    expect(result.endDate).toEqual(endDate)
    expect(result.goal).toEqual(goal)
  })

  it('should throw an error when the start marker is missing', () => {
    expect(
      objectUnderTest.decodeMissionBody.bind(null, 'blah blah blah'),
    ).toThrow(new Error('No start marker, cannot parse'))
  })

  it('should throw an error when the end marker is missing', () => {
    expect(
      objectUnderTest.decodeMissionBody.bind(
        null,
        'blah START-OF-MISSION blah blah',
      ),
    ).toThrow(new Error('No end marker, cannot parse'))
  })
})

function mockResp(mimeStr) {
  return {
    headers: {
      get: () => mimeStr,
    },
  }
}

function cloneableResp(obj) {
  obj.clone = function () {
    return obj
  }
  return obj
}
