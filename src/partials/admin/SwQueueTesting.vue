<template>
  <v-ons-card>
    <div class="title">SW Queue Testing</div>
    <h4>Create orphaned task</h4>
    <p>
      If multiple requests for a single UUID are queued in the SW, things
      *could* get weird. The callback after the first req will trigger cleanup
      of the local record and subsequent queued reqs won't have a local record
      to operate against when they complete. So it's important all the callback
      code is idempotent, which it is at the time of writing. This button will
      create an orphaned task to simulate subsequent requests.<br />
      <strong>Note:</strong> the facade needs to know about the UUID, so if an
      old record is chosen, you can do a NOOP edit so the facade knows the UUID
      and you don't get a 404.
    </p>
    <p>
      <v-ons-button @click="addOrphanedTask">Add orphaned task</v-ons-button>
    </p>
    <hr />
    <h4>Simulate SW queue replay HTTP error</h4>
    <p>
      If a replayed request in the SW queue has an HTTP error (we got a
      response, but it was non-200) then we need to marked the local record as
      error. This button will cause the SW to send a message indicating a
      failure.<br />
      <strong>Note:</strong> you must have a local record to operate on
    </p>
    <p>
      <v-ons-button @click="simulateQueueHttpError"
        >Simulate queue HTTP error</v-ons-button
      >
    </p>
  </v-ons-card>
</template>

<script>
import { mapGetters } from 'vuex'
import * as cc from '@/misc/constants'
import { getWebWorker } from '@/misc/web-worker-manager'

export default {
  name: 'SwQueueTesting',
  computed: {
    ...mapGetters('obs', ['remoteRecords', 'localRecords']),
  },
  methods: {
    addOrphanedTask() {
      const target = (() => {
        for (const curr of this.remoteRecords) {
          const isLocalRecordPresent = this.localRecords.some(
            (r) => r.uuid === curr.uuid,
          )
          if (isLocalRecordPresent) {
            continue
          }
          return curr
        }
      })()
      console.log(`Adding orphaned pending task for ${target.uuid}`)
      getWebWorker().addPendingTask({
        uuid: target.uuid,
        inatId: target.inatId,
        type: 'update',
        statusUrl: `${cc.facadeUrlBase}/task-status/${target.uuid}`,
      })
    },
    simulateQueueHttpError() {
      const target = this.localRecords[0]
      if (!target) {
        console.warn('No local records, cannot continue')
        return
      }
      // note: there wouldn't be a pending task, because the UI would be
      // waiting on the SW to send a message for success/failure. This test
      // doesn't remove the pending task that might exist.
      const theUuid = target.uuid
      this.$store.state.ephemeral.swReg.active.postMessage({
        msgId: 'simulateQueueHttpError',
        uuid: theUuid,
      })
    },
  },
}
</script>

<style lang="scss" scoped></style>
