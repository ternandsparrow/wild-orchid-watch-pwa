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
      <label>
        Number of records to create
        <v-ons-input v-model="recordsCount" type="number" />
      </label>
      <v-ons-button @click="doIt">Create observations</v-ons-button>
    </p>
    <p>{{ runStatus }}</p>
  </v-ons-card>
</template>

<script>
import uuid from 'uuid/v1'
import * as cc from '@/misc/constants'
import { getOrCreateInstance } from '@/indexeddb/storage-manager'
import { recordTypeEnum as recordType } from '@/misc/helpers'

export default {
  name: 'ExtractThumbnailFromExif',
  data() {
    return {
      runStatus: '(not yet run)',
      recordsCount: 20,
    }
  },
  methods: {
    async doIt() {
      // we're doing it all by hand because we have to replicate the format of
      // old records. If we used the helpers, we'd get the format of the new
      // records. This lets us test the migration code without having to jump
      // between versions of the app.
      try {
        let recordsCreated = 0
        this.runStatus = 'fetching photo bytes...'
        const photoBytes = await this.getPhotoBytes()
        this.runStatus = 'opening indexeddb...'
        const obsStore = getOrCreateInstance(cc.lfWowObsStoreName)
        while (recordsCreated < this.recordsCount) {
          recordsCreated += 1
          this.runStatus = `creating record ${recordsCreated}...`
          const recordId = uuid()
          const newPhotos = [
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
          const record = {
            captive_flag: false,
            geoprivacy: 'obscured',
            lat: -36.1,
            lng: 144.7,
            speciesGuess: 'orchid ' + recordsCreated,
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
          await obsStore.setItem(recordId, record)
        }
        this.$store.dispatch('obs/refreshLocalRecordQueue')
        this.runStatus = 'Clearing migration flag'
        const metaStore = getOrCreateInstance(cc.lfWowMetaStoreName)
        await metaStore.removeItem(cc.gh69MigrationKey)
      } catch (err) {
        console.error('Failed to run', err)
        this.runStatus = 'Failed. ' + err.message
      }
      this.runStatus = 'done :D'
    },
    async getPhotoBytes() {
      // we need a photo that's pretty big so we fill up memory quick.
      const url =
        'http://testdata.techotom.com/originals/samsung-s20-ultra-108mp-photo.jpg'
      const resp = await fetch(url)
      return resp.arrayBuffer()
    },
  },
}
</script>

<style lang="scss" scoped></style>
