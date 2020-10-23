<template>
  <v-ons-card>
    <div class="title">
      Benchmark extracting a thumbnail from all local photos (in IndexedDB)
    </div>
    <p class="text-center">
      This benchmark will iterate over all the obs records in IndexedDB and for
      each one, we'll try to extract the thumbnail from EXIF data.<br />
      <v-ons-button @click="doBenchmark">Do benchmark</v-ons-button>
    </p>
    <hr />
    <p>
      Results:
    </p>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Obs records processed</td>
          <td>{{ obsRecordsProcessed }}</td>
        </tr>
        <tr>
          <td>Photos processed</td>
          <td>{{ photosProcessed }}</td>
        </tr>
        <tr>
          <td>Photos with EXIF</td>
          <td>{{ photosWithExif }}</td>
        </tr>
        <tr>
          <td>Total elapsed time (ms)</td>
          <td>{{ totalElapsedTime }}</td>
        </tr>
      </tbody>
    </table>
    <h3>Thumbnails with no scaling</h3>
    <div v-for="curr of thumbs" :key="curr.thumbUrl">
      <div>
        Elapsed = {{ curr.elapsed }}ms, original image size={{
          curr.originalSize
        }}, thumbnail size={{ curr.thumbSize }}
      </div>
      <img :src="curr.thumbUrl" />
    </div>
  </v-ons-card>
</template>

<script>
import * as constants from '@/misc/constants'
import { mapOverObsStore } from '@/indexeddb/obs-store-common'
import { getExifFromBlob } from '@/misc/helpers'

export default {
  name: 'ExtractThumbnailFromExif',
  data() {
    return {
      obsRecordsProcessed: 0,
      photosProcessed: 0,
      photosWithExif: 0,
      totalElapsedTime: 0,
      thumbs: [],
    }
  },
  methods: {
    async doBenchmark() {
      const start = Date.now()
      const blobs = []
      const dataShape = await mapOverObsStore(r => {
        const photos = r.wowMeta[constants.photosToAddFieldName] || []
        const photoShape = []
        for (const curr of photos) {
          blobs.push(new Blob([new Uint8Array(curr.file.data)]))
          photoShape.push(1)
        }
        return photoShape
      })
      this.thumbs = []
      for (const curr of blobs) {
        // FIXME try-catch
        const currStart = Date.now()
        const exif = await getExifFromBlob(curr)
        const hasAnyExif = Object.keys(exif).length
        if (!hasAnyExif) {
          continue
        }
        const hasThumbnail = !!exif.thumbnail
        if (!hasThumbnail) {
          continue
        }
        const thumbBlob = exif.thumbnail.blob
        this.thumbs.push({
          blob: thumbBlob,
          originalSize: curr.size,
          thumbSize: thumbBlob.size,
          thumbUrl: URL.createObjectURL(thumbBlob), // this is memory leak by not revoking, but it's only a test
          elapsed: Date.now() - currStart,
        })
      }
      this.totalElapsedTime = Date.now() - start
      this.obsRecordsProcessed = dataShape.length
      this.photosProcessed = dataShape.reduce((accum, curr) => {
        accum += curr.length
        return accum
      }, 0)
      this.photosWithExif = this.thumbs.length
    },
  },
}
</script>

<style lang="scss" scoped></style>
