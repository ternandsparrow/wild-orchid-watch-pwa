/* eslint-disable */
// See https://github.com/ternandsparrow/wild-orchid-watch-pwa/blob/master/README.md#why-we-don-t-eslint-our-web-workers
// for why we disable eslint on web workers (it's a hacky workaround)
import * as Comlink from 'comlink'

const obj = {
  counter: 0,
  inc() {
    this.counter++
  },
}

Comlink.expose(obj)
