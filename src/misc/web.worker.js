// comlink doesn't play nice with unit tests, so we've pulled it out into its
// own file. Then we can test the worker logic on its own.
import { expose as comlinkExpose } from 'comlink'
import * as exposed from './web.worker.nocomlink'

comlinkExpose(exposed)
