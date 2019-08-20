import { isNil } from 'lodash'
import store from '@/store'

export default function() {
  const isIosOnBrowser =
    ['iPhone', 'iPad', 'iPod'].includes(navigator.platform) &&
    !window.navigator.standalone

  if (isIosOnBrowser) {
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
