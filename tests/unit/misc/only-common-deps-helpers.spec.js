import * as objectUnderTest from '@/misc/only-common-deps-helpers'

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
