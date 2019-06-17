import { register } from 'register-service-worker'

import store from '@/store/index'

if (process.env.NODE_ENV === 'production') {
  register('/service-worker.js', {
    ready() {
      console.log('Service worker is active.')
    },
    registered() {
      console.log('Service worker has been registered.')
    },
    cached() {
      store.commit('app/setRefreshingApp', false)
      console.log('Content has been cached for offline use.')
    },
    updatefound() {
      store.commit('app/setRefreshingApp', true) // FIXME should we bother with this?
      console.log('New content is downloading.')
    },
    updated(reg) {
      store.commit('app/setRefreshingApp', false)
      store.commit(`app/setSWRegistrationForNewContent`, reg)
      console.log('New content is available; please refresh.')
    },
    offline() {
      console.log(
        'No internet connection found. App is running in offline mode.',
      )
    },
    error(error) {
      console.error('Error during service worker registration:', error)
    },
  })
}

let refreshing = false
// This is triggered when a new service worker take over
if (!navigator.serviceWorker) {
  // FIXME why?!?!
  console.warn('No service worker! Things might break')
} else {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true

    window.location.reload()
  })
}
