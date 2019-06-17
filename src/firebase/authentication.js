import firebase from 'firebase/app'
import { isNil } from 'lodash'

import store from '@/store/index'

firebase.auth().onAuthStateChanged(firebaseUser => {
  const actionToDispatch = isNil(firebaseUser) ? 'logout' : 'login'
  store.dispatch(`auth/${actionToDispatch}`, firebaseUser)
})
