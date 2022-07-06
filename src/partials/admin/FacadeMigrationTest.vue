<template>
  <v-ons-card>
    <div class="title">
      Set up scenario to test migration code for adding the API Facade
    </div>
    <p>
      This tool will create a series of observations in the "old" format. It
      will also clear the "migration done" flag so on page refresh, the
      migration code will run.
    </p>
    <p>
      WARNING: this is destructive. It will edit and delete existing
      observations in your account!
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
        Include photos in the created and edited records?
      </label>
    </p>
    <p>
      <v-ons-button @click="doIt">Create observations</v-ons-button>
    </p>
    <p>{{ runStatus }}</p>
    <hr />
    <p>
      You can refresh the page and the migration will run, or click this button
      to trigger the migration now. This runs *all* migrations, not just the API
      facade one. This shouldn't matter but at least you know, in case it does
      matter.
    </p>
    <v-ons-button @click="doMigration">Trigger migration now</v-ons-button>
    <p>{{ migrateStatus }}</p>
  </v-ons-card>
</template>

<script>
import uuid from 'uuid/v1'
import { mapGetters } from 'vuex'
import * as cc from '@/misc/constants'
import { getOrCreateInstance } from '@/indexeddb/storage-manager'
import { migrate } from '@/store/obs'

export default {
  name: 'FacadeMigrationTest',
  data() {
    return {
      runStatus: '(not yet run)',
      recordsCount: 3,
      migrateStatus: '(not yet run)',
      isIncludePhotos: true,
      cachedPhotos: null,
    }
  },
  computed: {
    ...mapGetters('obs', ['remoteRecords']),
  },
  methods: {
    log(msg) {
      console.debug(msg)
      this.runStatus = msg
    },
    async doIt() {
      // we're doing it all by hand because we have to replicate the format of
      // old records. If we used the helpers, we'd get the format of the new
      // records. This lets us test the migration code without having to jump
      // between versions of the app.
      try {
        let recordsCreated = 0
        this.log('opening indexeddb...')
        const recordSavePromises = []
        while (recordsCreated < this.recordsCount) {
          recordsCreated += 1
          this.log(`creating record ${recordsCreated}...`)
          const fns = [
            this.createNewTypeRecord,
            this.createEditTypeRecord,
            // FIXME add delete
          ]
          const theFn = fns[Math.floor(Math.random() * fns.length)]
          recordSavePromises.push(theFn(recordsCreated))
        }
        await Promise.all(recordSavePromises)
        this.$store.dispatch('obs/refreshLocalRecordQueue')
        this.log('Clearing migration flag')
        const metaStore = getOrCreateInstance(cc.lfWowMetaStoreName)
        await metaStore.removeItem(cc.facadeMigrationKey)
        this.log('done :D')
      } catch (err) {
        console.error('Failed to run', err)
        this.log(`Failed. ${err.message}`)
      }
    },
    async createNewTypeRecord(i) {
      const newPhotos = await this.getPhotos()
      const recordId = uuid()
      const record = {
        captive_flag: false,
        geoprivacy: 'obscured',
        lat: -36.1,
        lng: 144.7,
        speciesGuess: `orchid ${i}`,
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
          [cc.recordTypeFieldName]: 'new', // can't use recordType()
          [cc.recordProcessingOutcomeFieldName]: cc.waitingOutcome,
          [cc.photosToAddFieldName]: newPhotos,
          [cc.photoIdsToDeleteFieldName]: [],
          [cc.obsFieldIdsToDeleteFieldName]: [],
          [cc.wowUpdatedAtFieldName]: new Date().toString(),
          [cc.outcomeLastUpdatedAtFieldName]: new Date().toString(),
          [cc.versionFieldName]: 2,
          blockedAction: {
            recordType: 'edit',
            // other fields don't matter, whole blockedAction should be dropped
          },
        },
        uuid: recordId,
      }
      const obsStore = getOrCreateInstance(cc.lfWowObsStoreName)
      await obsStore.setItem(recordId, record)
    },
    async createEditTypeRecord() {
      const obsStore = getOrCreateInstance(cc.lfWowObsStoreName)
      const recordId =
        this.remoteRecords[
          Math.floor(Math.random() * this.remoteRecords.length)
        ].uuid
      // FIXME won't work, need to get from remote obs store
      const record = await obsStore.getItem(recordId)
      record.speciesGuess += ' edit'
      await obsStore.setItem(recordId, record)
    },
    async getPhotos() {
      if (!this.isIncludePhotos) {
        return []
      }
      if (this.cachedPhotos) {
        return this.cachedPhotos
      }
      this.log('fetching photo bytes...')
      const photoBytes = await this.getPhotoBytes()
      const photoTypes = [
        cc.photoTypeWholePlant,
        cc.photoTypeHabitat,
        cc.photoTypeMicrohabitat,
        cc.photoTypeLeaf,
        cc.photoTypeFlower,
      ]
      this.cachedPhotos = photoTypes.map((currType, i) => ({
        id: -1 * (i + 1),
        url: '(set at render time)',
        file: {
          data: photoBytes,
          mime: 'image/jpeg',
        },
        type: currType,
      }))
      return this.cachedPhotos
    },
    async getPhotoBytes() {
      const url = 'https://testdata.techotom.com/originals/thomas-rolling.jpg'
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
