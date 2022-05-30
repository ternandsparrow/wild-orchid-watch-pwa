import objectUnderTest from '@/store/ephemeral'

const { mutations } = objectUnderTest

describe('ephemeral module mutations', () => {
  describe('setNetworkOnline', () => {
    it('should set network online state to the value given in parameter', () => {
      const state = {
        networkOnLine: false,
        SWRegistrationForNewContent: null,
        showAddToHomeScreenModalForApple: false,
        refreshingApp: false,
      }

      mutations.setNetworkOnline(state, true)

      expect(state).toEqual({
        networkOnLine: true,
        SWRegistrationForNewContent: null,
        showAddToHomeScreenModalForApple: false,
        refreshingApp: false,
      })
    })
  })

  describe('pushPhotoCoords', () => {
    it('should add coords to empty array', () => {
      const state = {
        photoCoords: [],
      }
      mutations.pushPhotoCoords(state, { photoUuid: 'AAA111' })
      expect(state).toEqual({
        photoCoords: [{ photoUuid: 'AAA111' }],
      })
    })

    it('should add coords to end of populated array', () => {
      const state = {
        photoCoords: [{ photoUuid: 'AAA111' }, { photoUuid: 'BBB222' }],
      }
      mutations.pushPhotoCoords(state, { photoUuid: 'CCC333' })
      expect(state).toEqual({
        photoCoords: [
          { photoUuid: 'AAA111' },
          { photoUuid: 'BBB222' },
          { photoUuid: 'CCC333' },
        ],
      })
    })
  })

  describe('popCoordsForPhoto', () => {
    it('should remove coords when we find a match', () => {
      const state = {
        photoCoords: [{ photoUuid: 'AAA111' }, { photoUuid: 'BBB222' }],
      }
      mutations.popCoordsForPhoto(state, 'AAA111')
      expect(state).toEqual({
        photoCoords: [{ photoUuid: 'BBB222' }],
      })
    })

    it('should not explode when we do not find a match', () => {
      const state = {
        photoCoords: [{ photoUuid: 'AAA111' }, { photoUuid: 'BBB222' }],
      }
      mutations.popCoordsForPhoto(state, 'CCC333')
      expect(state).toEqual({
        photoCoords: [{ photoUuid: 'AAA111' }, { photoUuid: 'BBB222' }],
      })
    })

    it('should not explode when there are no coords', () => {
      const state = {
        photoCoords: [],
      }
      mutations.popCoordsForPhoto(state, 'CCC333')
      expect(state).toEqual({
        photoCoords: [],
      })
    })
  })

  describe('setSWRegistrationForNewContent', () => {
    it('should set new content available state to the value given in parameter', () => {
      const state = {
        networkOnLine: false,
        SWRegistrationForNewContent: null,
        showAddToHomeScreenModalForApple: false,
        refreshingApp: false,
      }
      const newSW = { id: 'sw' }

      mutations.setSWRegistrationForNewContent(state, newSW)

      expect(state).toEqual({
        networkOnLine: false,
        SWRegistrationForNewContent: newSW,
        showAddToHomeScreenModalForApple: false,
        refreshingApp: false,
      })
    })
  })

  describe('setShowAddToHomeScreenModalForApple', () => {
    it('should set show add to home screen modal for apple state to the value given in parameter', () => {
      const state = {
        networkOnLine: false,
        SWRegistrationForNewContent: null,
        showAddToHomeScreenModalForApple: false,
        refreshingApp: false,
      }

      mutations.setShowAddToHomeScreenModalForApple(state, true)

      expect(state).toEqual({
        networkOnLine: false,
        SWRegistrationForNewContent: null,
        showAddToHomeScreenModalForApple: true,
        refreshingApp: false,
      })
    })
  })

  describe('refreshingApp', () => {
    it('should set refreshingApp state to the value given in parameter', () => {
      const state = {
        networkOnLine: false,
        SWRegistrationForNewContent: null,
        showAddToHomeScreenModalForApple: false,
        refreshingApp: false,
      }

      mutations.setRefreshingApp(state, true)

      expect(state).toEqual({
        networkOnLine: false,
        SWRegistrationForNewContent: null,
        showAddToHomeScreenModalForApple: false,
        refreshingApp: true,
      })
    })
  })
})
