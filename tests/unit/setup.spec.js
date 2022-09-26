// test the custom matchers and other things we create in the setup script

describe('custom matchers', () => {
  describe('toBeValidDateString', () => {
    it('should match a ISO date', () => {
      const val = '2020-11-03T01:36:08.347Z'
      expect(val).toEqual(expect.toBeValidDateString())
    })

    it('should match a pretty date', () => {
      const val =
        'Tue Nov 03 2020 12:07:15 GMT+1030 (Australian Central Daylight Time)'
      expect(val).toEqual(expect.toBeValidDateString())
    })

    it('should reject an invalid date', () => {
      const val = 'blah'
      try {
        expect(val).toEqual(expect.toBeValidDateString())
        fail('should have thrown error')
      } catch (err) {
        // success
      }
    })
  })

  describe('toBeUuidString', () => {
    it('should match a valid UUID', () => {
      const val = '11cb4fb2-1d78-11eb-8f3b-b5261e5ec477'
      expect(val).toEqual(expect.toBeUuidString())
    })

    it('should reject an invalid value', () => {
      const val = '123a'
      try {
        expect(val).toEqual(expect.toBeUuidString())
        fail('should have thrown error')
      } catch (err) {
        // success
      }
    })
  })
})
