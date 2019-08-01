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

function mockResp(mimeStr) {
  return {
    headers: {
      get: () => mimeStr,
    },
  }
}
