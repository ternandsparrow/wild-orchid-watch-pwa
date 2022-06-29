import { wrap as comlinkWrap } from 'comlink'

let comlinkWrappedWebWorker = null
const subscriptions = {}

export function subscribeToWorkerMessage(messageKey, callbackFn) {
  const subscribers = subscriptions[messageKey] || []
  subscribers.push(callbackFn)
  subscriptions[messageKey] = subscribers
}

export function getWebWorker() {
  if (!comlinkWrappedWebWorker) {
    comlinkWrappedWebWorker = interceptableFns.buildWorker()
  }
  return comlinkWrappedWebWorker
}

const interceptableFns = {
  buildWorker() {
    const result = new Worker(new URL('./web.worker.js', import.meta.url), {
      type: 'module',
    })
    result.addEventListener('message', (event) => {
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
        const cbResult = currCb(event.data.data)
        if (cbResult && cbResult.constructor === Promise) {
          cbResult.catch((err) => {
            console.error(`Async subscriber for key=${key} threw an error`, err)
          })
        }
      }
    })
    return comlinkWrap(result)
  },
}

export const _testonly = {
  interceptableFns,
}
