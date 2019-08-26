import { _testonly } from '@/misc/helpers'

describe('makeEnumValidator', () => {
  it('should handle valid enum array and valid input to Fn', () => {
    const fooStatuses = ['aaa', 'bbb', 'ccc']
    const fooStatus = _testonly.makeEnumValidator(fooStatuses)
    const result = fooStatus('aaa')
    expect(result).toEqual('aaa')
  })

  it('should explode for valid enum array and INvalid input to Fn', () => {
    const fooStatuses = ['aaa', 'bbb', 'ccc']
    const fooStatus = _testonly.makeEnumValidator(fooStatuses)
    try {
      fooStatus('notvalid')
      fail('should throw error as input is not valid in the "enum"')
    } catch (err) {
      // success
    }
  })

  it('should explode with an empty array', () => {
    try {
      _testonly.makeEnumValidator([])
      fail('error should be thrown')
    } catch (err) {
      // success
    }
  })

  it('should explode with a non-array input', () => {
    try {
      _testonly.makeEnumValidator({ ka: 'boom' })
      fail('error should be thrown')
    } catch (err) {
      // success
    }
  })
})

describe('formatMetricDistance', () => {
  it('should handle less than 1 km', () => {
    const result = _testonly.formatMetricDistance(123)
    expect(result).toEqual('123m')
  })

  it('should handle greater than 1 km', () => {
    const result = _testonly.formatMetricDistance(8323)
    expect(result).toEqual('8.3km')
  })

  it('should handle 0', () => {
    const result = _testonly.formatMetricDistance(0)
    expect(result).toEqual(0)
  })

  it('should handle falsy', () => {
    const result = _testonly.formatMetricDistance(null)
    expect(result).toBeNull()
  })
})

describe('isRespJson', () => {
  it('should handle a basic application/json', () => {
    const resp = mockResp('application/json')
    const result = _testonly.isRespJson(resp)
    expect(result).toEqual(true)
  })

  it('should handle a charset', () => {
    const resp = mockResp('application/json; charset=utf-8')
    const result = _testonly.isRespJson(resp)
    expect(result).toEqual(true)
  })

  it('should handle a short vendor tree extension', () => {
    const resp = mockResp('application/vnd.example+json')
    const result = _testonly.isRespJson(resp)
    expect(result).toEqual(true)
  })

  it('should handle a longer vendor tree extension', () => {
    const resp = mockResp('application/vnd.example.blah.something+json')
    const result = _testonly.isRespJson(resp)
    expect(result).toEqual(true)
  })

  it('should consider html as false', () => {
    const resp = mockResp('text/html')
    const result = _testonly.isRespJson(resp)
    expect(result).toEqual(false)
  })

  it('should handle an empty string', () => {
    const resp = mockResp('')
    const result = _testonly.isRespJson(resp)
    expect(result).toEqual(false)
  })

  it('should handle a null', () => {
    const resp = mockResp(null)
    const result = _testonly.isRespJson(resp)
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
    _testonly.verifyWowDomainPhoto(record)
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
      _testonly.verifyWowDomainPhoto(record)
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
      _testonly.verifyWowDomainPhoto(record)
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
      _testonly.verifyWowDomainPhoto(record)
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
      _testonly.verifyWowDomainPhoto(record)
      fail('error should have been thrown')
    } catch (err) {
      // success
    }
  })
})

describe('buildUrlSuffix', () => {
  it('should build a URL with no params', () => {
    const result = _testonly.buildUrlSuffix('/blah')
    expect(result).toEqual('/blah')
  })

  it('should build a URL with empty params', () => {
    const result = _testonly.buildUrlSuffix('/blah', {})
    expect(result).toEqual('/blah')
  })

  it('should build a URL with one param', () => {
    const result = _testonly.buildUrlSuffix('/blah', { foo: 'bar' })
    expect(result).toEqual('/blah?foo=bar')
  })

  it('should build a URL with params', () => {
    const result = _testonly.buildUrlSuffix('/blah', { foo: 'bar', baz: 123 })
    expect(result).toEqual('/blah?foo=bar&baz=123')
  })

  it('should exclude params that are null-ish', () => {
    const result = _testonly.buildUrlSuffix('/blah', {
      foo: 'bar',
      baz: null,
      something: undefined,
    })
    expect(result).toEqual('/blah?foo=bar')
  })
})

function mockResp(mimeStr) {
  return {
    headers: {
      get: () => mimeStr,
    },
  }
}
