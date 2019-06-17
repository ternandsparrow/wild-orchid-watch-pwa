import store from '@/store/index'

store.commit('app/setNetworkOnline', navigator.onLine)

window.addEventListener('online', () =>
  store.commit('app/setNetworkOnline', true),
)

window.addEventListener('offline', () =>
  store.commit('app/setNetworkOnline', false),
)
