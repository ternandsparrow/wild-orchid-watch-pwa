import { isNil } from 'lodash'
import store from '@/store'

export default function() {
  const ua = window.navigator.userAgent
  const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i)
  const webkit = !!ua.match(/WebKit/i)
  const iOSSafari = iOS && webkit && !ua.match(/CriOS/i)

  // We only do this for Mobile Safari - Chrome currently doesn't support the Add-to_home function
  // https://stackoverflow.com/questions/50319831/can-i-use-add-to-home-screen-in-chrome-on-an-ios-device
  if (iOSSafari) {
    const now = Date.now()
    let limitDate = null
    const addToHomeIosPromptLastDate =
      store.state.app.addToHomeIosPromptLastDate

    if (!isNil(addToHomeIosPromptLastDate)) {
      limitDate = new Date(parseInt(addToHomeIosPromptLastDate))
      limitDate.setMonth(limitDate.getMonth() + 1)
    }

    if (isNil(limitDate) || now >= limitDate.getTime()) {
      store.commit('ephemeral/setShowAddToHomeScreenModalForApple', true)
    }
  }
}
