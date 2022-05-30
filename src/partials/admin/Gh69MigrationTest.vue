<template>
  <v-ons-card>
    <div class="title">
      Set up scenario to test migration code for
      <a
        href="https://github.com/ternandsparrow/wild-orchid-watch-pwa/issues/69"
        >GH-69</a
      >
    </div>
    <p>
      This tool will create a series of observations in the "old" format where
      they have the images stored as part of the observation record. The idea is
      to create enough observations that we're using quite a bit of memory.
      Enought that trying to create another observation would trigger an
      out-of-memory condition. That way the migration code is not just tested
      for logic but that it can stop the UI from chewing up memory while it gets
      the job done. It will also clear the "migration done" flag so on page
      refresh, the migration code will run.<br />
    </p>
    <p>
      <label for="record-count"> Number of records to create </label>
      <br />
      <v-ons-input
        v-model="recordsCount"
        type="number"
        input-id="record-count"
      />
    </p>
    <p>
      <v-ons-checkbox v-model="isIncludePhotos" input-id="is-include-photos" />
      <label for="is-include-photos">
        Include photos in the created records?
      </label>
    </p>
    <p>
      <v-ons-button @click="doIt">Create observations</v-ons-button>
    </p>
    <p>{{ runStatus }}</p>
    <hr />
    <p>
      You can refresh the page and the migration run, or click this button to
      trigger it now. This runs *all* migrations, not just the GH-69 one. This
      shouldn't matter but at least you know if it does.
    </p>
    <v-ons-button @click="doMigration">Trigger migration now</v-ons-button>
    <p>{{ migrateStatus }}</p>
  </v-ons-card>
</template>

<script>
import uuid from 'uuid/v1'
import * as cc from '@/misc/constants'
import { getOrCreateInstance } from '@/indexeddb/storage-manager'
import { recordTypeEnum as recordType } from '@/misc/helpers'
import { migrate } from '@/store/obs'

export default {
  name: 'Gh69MigrationTest',
  data() {
    return {
      runStatus: '(not yet run)',
      recordsCount: 10,
      migrateStatus: '(not yet run)',
      isIncludePhotos: true,
    }
  },
  methods: {
    async doIt() {
      const log = (msg) => {
        console.debug(msg)
        this.runStatus = msg
      }
      // we're doing it all by hand because we have to replicate the format of
      // old records. If we used the helpers, we'd get the format of the new
      // records. This lets us test the migration code without having to jump
      // between versions of the app.
      try {
        let recordsCreated = 0
        const newPhotos = await (async () => {
          if (!this.isIncludePhotos) {
            return []
          }
          log('fetching photo bytes...')
          const photoBytes = await this.getPhotoBytes()
          return [
            cc.photoTypeWholePlant,
            cc.photoTypeHabitat,
            cc.photoTypeMicrohabitat,
            cc.photoTypeLeaf,
            cc.photoTypeFlower,
          ].map((currType, i) => ({
            id: -1 * (i + 1),
            url: '(set at render time)',
            file: {
              data: photoBytes,
              mime: 'image/jpeg',
            },
            type: currType,
          }))
        })()
        log('opening indexeddb...')
        const obsStore = getOrCreateInstance(cc.lfWowObsStoreName)
        const recordSavePromises = []
        while (recordsCreated < this.recordsCount) {
          recordsCreated += 1
          log(`creating record ${recordsCreated}...`)
          const recordId = uuid()
          const record = {
            captive_flag: false,
            geoprivacy: 'obscured',
            lat: -36.1,
            lng: 144.7,
            speciesGuess: `orchid ${recordsCreated}`,
            observedAt: new Date(),
            obsFieldValues: [
              {
                datatype: 'text',
                fieldId: 39,
                name: 'Orchid type',
                value: 'Terrestrial',
              },
              {
                datatype: 'text',
                fieldId: 51,
                name: 'Accuracy of population count',
                value: 'Exact',
              },
              {
                datatype: 'numeric',
                fieldId: 53,
                name: 'Number of individuals recorded',
                value: 1,
              },
            ],
            photos: newPhotos,
            positional_accuracy: null,
            wowMeta: {
              [cc.recordTypeFieldName]: recordType('new'),
              [cc.recordProcessingOutcomeFieldName]: cc.waitingOutcome,
              [cc.photosToAddFieldName]: newPhotos,
              [cc.photoIdsToDeleteFieldName]: [],
              [cc.obsFieldIdsToDeleteFieldName]: [],
              [cc.wowUpdatedAtFieldName]: new Date().toString(),
              [cc.outcomeLastUpdatedAtFieldName]: new Date().toString(),
            },
            uuid: recordId,
          }
          recordSavePromises.push(obsStore.setItem(recordId, record))
        }
        await Promise.all(recordSavePromises)
        this.$store.dispatch('obs/refreshLocalRecordQueue')
        log('Clearing migration flag')
        const metaStore = getOrCreateInstance(cc.lfWowMetaStoreName)
        await metaStore.removeItem(cc.gh69MigrationKey)
        log('done :D')
      } catch (err) {
        console.error('Failed to run', err)
        log(`Failed. ${err.message}`)
      }
    },
    async getPhotoBytes() {
      // we need a photo that's pretty big so we fill up memory quick.
      const url =
        'https://testdata.techotom.com/originals/samsung-s20-ultra-108mp-photo.jpg'
      const resp = await fetch(url)
      return resp.arrayBuffer()
    },
    async doMigration() {
      try {
        this.migrateStatus = 'starting...'
        await migrate(this.$store)
        this.migrateStatus = 'done :D'
      } catch (err) {
        console.error('Failed to migrate', err)
        this.migrateStatus = `Failed. ${err.message}`
      }
    },
  },
}
</script>

<style lang="scss" scoped></style>
