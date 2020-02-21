import moment from 'moment'
import * as objectUnderTest from '@/misc/helpers'

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

describe('squareAreaValueToTitle', () => {
  it('should handle 1', () => {
    const result = objectUnderTest.squareAreaValueToTitle(1)
    expect(result).toEqual('1x1 (1m²)')
  })

  it('should handle a number, that is a sqaure, that is larger than 1', () => {
    const result = objectUnderTest.squareAreaValueToTitle(25)
    expect(result).toEqual('5x5 (25m²)')
  })

  it('should not explode when we have a number that does not fit nicely', () => {
    const result = objectUnderTest.squareAreaValueToTitle(33)
    // it's not pretty but it's not an error. Just configure the app correctly
    // and it won't matter as you'll never see an ugly value like this.
    expect(result).toEqual('5.744562646538029x5.744562646538029 (33m²)')
  })

  it('should handle a stringy number', () => {
    const result = objectUnderTest.squareAreaValueToTitle('36')
    expect(result).toEqual('6x6 (36m²)')
  })

  it('should handle a non-number input', () => {
    const result = objectUnderTest.squareAreaValueToTitle('>100')
    expect(result).toEqual('>100')
  })
})

describe('rectangleAlongPathAreaValueToTitle', () => {
  it('should handle 2', () => {
    const result = objectUnderTest.rectangleAlongPathAreaValueToTitle(2)
    expect(result).toEqual('1x2 (i.e. 2m² or similar)')
  })

  it('should handle a number that is larger than 1', () => {
    const result = objectUnderTest.rectangleAlongPathAreaValueToTitle(24)
    expect(result).toEqual('12x2 (i.e. 24m² or similar)')
  })

  it('should not explode when we have a number that does not fit nicely', () => {
    const result = objectUnderTest.rectangleAlongPathAreaValueToTitle(33)
    expect(result).toEqual('16.5x2 (i.e. 33m² or similar)')
  })

  it('should handle a stringy number', () => {
    const result = objectUnderTest.rectangleAlongPathAreaValueToTitle('36')
    expect(result).toEqual('18x2 (i.e. 36m² or similar)')
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
    const name = 'some name'
    const endDate = '2020-02-28'
    const goal = 'some goal'
    const encoded = objectUnderTest.encodeMissionBody(name, endDate, goal)
    const result = objectUnderTest.decodeMissionBody(encoded)
    expect(result.name).toEqual(name)
    expect(moment(result.startDate).isBefore(moment(endDate))).toEqual(true)
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
