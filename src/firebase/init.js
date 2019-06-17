import firebase from 'firebase/app'
import 'firebase/auth'

// The configuration below is not sensitive data. You can serenely add your config here
const config = {
  apiKey: 'AIzaSyA0RYjFEKWhHA1hrLd-DeIFclpkAmj9jts',
  authDomain: 'wow-inspiring-australia.firebaseapp.com',
  databaseURL: 'https://wow-inspiring-australia.firebaseio.com',
  projectId: 'wow-inspiring-australia',
  storageBucket: 'wow-inspiring-australia.appspot.com',
  messagingSenderId: '712439358186',
  appId: '1:712439358186:web:8525b5ce8e5ff37c',
}

firebase.initializeApp(config)
