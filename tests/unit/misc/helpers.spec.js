import { _testonly } from '@/misc/helpers'

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

function mockResp(mimeStr) {
  return {
    headers: {
      get: () => mimeStr,
    },
  }
}
