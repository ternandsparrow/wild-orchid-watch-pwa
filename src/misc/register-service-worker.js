import { register } from 'register-service-worker'

import store from '@/store/index'

if (process.env.NODE_ENV === 'production') {
  register('/service-worker.js', {
    ready() {
      console.debug('Service worker is active.')
    },
    registered(registration) {
      console.debug('Service worker has been registered.')
      // TODO is this the right spot, or is ready() better?
      store.commit('ephemeral/setServiceWorkerRegistration', registration)
    },
    cached() {
      store.commit('ephemeral/setRefreshingApp', false)
      console.debug('Content has been cached for offline use.')
    },
    updatefound() {
      store.commit('ephemeral/setRefreshingApp', true)
      console.debug('New content is downloading.')
    },
    updated(reg) {
      store.commit('ephemeral/setRefreshingApp', false)
      store.commit(`ephemeral/setSWRegistrationForNewContent`, reg)
      console.debug('New content is available; please refresh.')
    },
    offline() {
      console.debug(
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
  console.warn(
    'No service worker! Things might break. Are you ' +
      'serving on localhost OR over HTTPS?',
  )
} else {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })
}
