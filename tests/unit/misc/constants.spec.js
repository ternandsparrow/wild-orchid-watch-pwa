import { _testonly as objectUnderTest } from '@/misc/constants'

describe('convertAndAssertInteger', () => {
  it('should parse a positive integer', () => {
    const result = objectUnderTest.convertAndAssertInteger('123')
    expect(result).toEqual(123)
    expect(typeof result).toEqual('number')
  })

  it('should parse a negative integer', () => {
    const result = objectUnderTest.convertAndAssertInteger('-346')
    expect(result).toEqual(-346)
    expect(typeof result).toEqual('number')
  })

  it('should parse zero', () => {
    const result = objectUnderTest.convertAndAssertInteger('0')
    expect(result).toEqual(0)
    expect(typeof result).toEqual('number')
  })

  it('should reject something with characters', () => {
    try {
      objectUnderTest.convertAndAssertInteger('12a3')
      fail()
    } catch (err) {
      expect(err.message.startsWith('Runtime config problem')).toBeTruthy()
    }
  })

  it('should reject a float', () => {
    try {
      objectUnderTest.convertAndAssertInteger('12.34')
      fail()
    } catch (err) {
      expect(err.message.startsWith('Runtime config problem')).toBeTruthy()
    }
  })
})

describe('convertAndAssertFloat', () => {
  it('should parse a positive float', () => {
    const result = objectUnderTest.convertAndAssertFloat('123.46')
    expect(result).toEqual(123.46)
    expect(typeof result).toEqual('number')
  })

  it('should parse a negative float', () => {
    const result = objectUnderTest.convertAndAssertFloat('-346.97')
    expect(result).toEqual(-346.97)
    expect(typeof result).toEqual('number')
  })

  it('should parse a positive integer', () => {
    const result = objectUnderTest.convertAndAssertFloat('123')
    expect(result).toEqual(123)
    expect(typeof result).toEqual('number')
  })

  it('should parse a negative integer', () => {
    const result = objectUnderTest.convertAndAssertFloat('-346')
    expect(result).toEqual(-346)
    expect(typeof result).toEqual('number')
  })

  it('should parse zero', () => {
    const result = objectUnderTest.convertAndAssertFloat('0')
    expect(result).toEqual(0)
    expect(typeof result).toEqual('number')
  })

  it('should reject something with characters', () => {
    try {
      objectUnderTest.convertAndAssertFloat('12a3')
      fail()
    } catch (err) {
      expect(err.message.startsWith('Runtime config problem')).toBeTruthy()
    }
  })

  it('should reject a trailing dot', () => {
    try {
      objectUnderTest.convertAndAssertFloat('12.')
      fail()
    } catch (err) {
      expect(err.message.startsWith('Runtime config problem')).toBeTruthy()
    }
  })
})

describe('parseBoolean', () => {
  it('should parse "true"', () => {
    const result = objectUnderTest.parseBoolean('true')
    expect(result).toEqual(true)
  })

  it('should parse "1"', () => {
    const result = objectUnderTest.parseBoolean('1')
    expect(result).toEqual(true)
  })

  it('should parse "false"', () => {
    const result = objectUnderTest.parseBoolean('false')
    expect(result).toEqual(false)
  })

  it('should parse other truthy stuff', () => {
    const result = objectUnderTest.parseBoolean('blah')
    expect(result).toEqual(true)
  })

  it('should handle falsey', () => {
    const result = objectUnderTest.parseBoolean('')
    expect(result).toEqual(false)
  })
})
