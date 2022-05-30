import { wrap as comlinkWrap } from 'comlink'

let webWorker = null
let comlinkWrappedWebWorker = null
const subscriptions = {}

function getRawWorker() {
  if (!webWorker) {
    webWorker = new Worker('./web.worker.js', {
      type: 'module',
    })
    webWorker.addEventListener('message', event => {
      // we'll get all the comlink events here too, but we don't care about
      // them. We only want to look for ones that we explicitly send
      const key = event.data.wowKey
      if (!key) {
        return
      }
      const subscribers = subscriptions[key]
      if (!subscribers) {
        console.warn(`No subscribers for worker event: "${key}"`)
        return
      }
      for (const currCb of subscribers) {
        const result = currCb(event.data.data)
        if (result && result.constructor === Promise) {
          result.catch(err => {
            console.error(`Async subscriber for key=${key} threw an error`, err)
          })
        }
      }
    })
  }
  return webWorker
}

export function subscribeToWorkerMessage(messageKey, callbackFn) {
  const subscribers = subscriptions[messageKey] || []
  subscribers.push(callbackFn)
  subscriptions[messageKey] = subscribers
}

export function getWebWorker() {
  if (!comlinkWrappedWebWorker) {
    comlinkWrappedWebWorker = comlinkWrap(getRawWorker())
  }
  return comlinkWrappedWebWorker
}
