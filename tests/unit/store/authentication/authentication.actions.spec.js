import { createNewUserFromFirebaseAuthUser } from '@/misc/helpers'
import authStore from '@/store/auth'

const actions = authStore.actions

const mockUsersDbRead = jest.fn()
jest.mock('@/firebase/users-db', () =>
  jest.fn().mockImplementation(() => ({ read: mockUsersDbRead })),
)
jest.mock('@/misc/helpers', () => ({
  createNewUserFromFirebaseAuthUser: jest.fn(),
}))

const commit = jest.fn()
const dispatch = jest.fn()
const user = {
  displayName: 'Robert Bob',
  photoUrl: 'https://my-awesome-photo.com',
  email: 'robert.bob@mail.com',
}

afterEach(() => {
  commit.mockReset()
  dispatch.mockReset()
  mockUsersDbRead.mockReset()
  createNewUserFromFirebaseAuthUser.mockReset()
})

describe('authentication module action', () => {
  describe('login', () => {
    const firebaseUser = { providerData: [user] }

    it('should set user with existing user', async () => {
      mockUsersDbRead.mockResolvedValue(Promise.resolve(user))
      await actions.login({ commit, dispatch }, firebaseUser)

      expect(commit).toHaveBeenCalledWith('setUser', user)
    })

    it('should set user with a new created user', async () => {
      const newCreatedUser = { id: 1 }
      mockUsersDbRead.mockResolvedValue(Promise.resolve(undefined))
      createNewUserFromFirebaseAuthUser.mockImplementation(() =>
        Promise.resolve(newCreatedUser),
      )

      await actions.login({ commit, dispatch }, firebaseUser)

      expect(commit).toHaveBeenCalledWith('setUser', newCreatedUser)
    })
  })

  describe('logout', () => {
    it('should set the user to null', async () => {
      await actions.logout({ commit, dispatch })

      expect(commit).toHaveBeenCalledWith('setUser', null)
    })
  })
})
