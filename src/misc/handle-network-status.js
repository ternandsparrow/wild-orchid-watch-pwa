import store from '@/store/index'

store.commit('ephemeral/setNetworkOnline', navigator.onLine)

window.addEventListener('online', () =>
  store.commit('ephemeral/setNetworkOnline', true),
)

window.addEventListener('offline', () =>
  store.commit('ephemeral/setNetworkOnline', false),
)
