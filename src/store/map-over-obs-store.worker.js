import { expose as comlinkExpose } from 'comlink'
import * as constants from '@/misc/constants'
import { mapOverObsStore } from '@/indexeddb/obs-store-common'
import { recordTypeEnum } from '@/misc/helpers'

comlinkExpose({
  doit,
})

async function doit() {
  const result = await mapOverObsStore(r => {
    const hasBlockedAction = !!r.wowMeta[constants.blockedActionFieldName]
    const isEventuallyDeleted = hasBlockedAction
      ? r.wowMeta[constants.blockedActionFieldName].wowMeta[
          constants.recordTypeFieldName
        ] === recordTypeEnum('delete')
      : r.wowMeta[constants.recordTypeFieldName] === recordTypeEnum('delete')
    return {
      [constants.recordTypeFieldName]: r.wowMeta[constants.recordTypeFieldName],
      [constants.isEventuallyDeletedFieldName]: isEventuallyDeleted,
      [constants.recordProcessingOutcomeFieldName]:
        r.wowMeta[constants.recordProcessingOutcomeFieldName],
      [constants.hasBlockedActionFieldName]: hasBlockedAction,
      wowUpdatedAt: r.wowMeta.wowUpdatedAt,
      inatId: r.inatId,
      uuid: r.uuid,
    }
  })
  return result
}

export const _testonly = {
  doit,
}
