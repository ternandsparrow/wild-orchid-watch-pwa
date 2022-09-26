import objectUnderTest from '@/store/ephemeral'

const { getters } = objectUnderTest

describe('app module getters', () => {
  describe('newContentAvailable', () => {
    it('should return true if SWRegistrationForNewContent is not null', () => {
      const result = getters.newContentAvailable({
        SWRegistrationForNewContent: {},
      })

      expect(result).toBe(true)
    })

    it('should return false if SWRegistrationForNewContent is null', () => {
      const result = getters.newContentAvailable({
        SWRegistrationForNewContent: null,
      })

      expect(result).toBe(false)
    })
  })
})
