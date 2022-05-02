<template>
  <v-ons-card>
    <div class="title">Send a bundle to the API facade</div>
    <p>Used during dev of the "use facade for upload" feature</p>
    <div>
      <label>
        Number of photos to attach
        <input v-model="photoCount" type="number" />
      </label>
    </div>
    <div>
      <v-ons-button @click="sendBundle">Send it</v-ons-button>
    </div>
    <div id="outcome">Outcome: {{ outcome }}</div>
  </v-ons-card>
</template>

<script>
import uuid from 'uuid/v1'
import * as constants from '@/misc/constants'
import { postFormDataWithAuth } from '@/misc/helpers'

export default {
  name: 'SendBundle',
  data() {
    return {
      photoCount: 3,
      outcome: '(nothing yet)',
      theUuid: null,
    }
  },
  methods: {
    async sendBundle() {
      this.outcome = `[${new Date().toISOString()}] processing...`
      const apiToken = this.$store.state.auth.apiToken
      const imgBytes = await this.getImgBytes()
      const resp = await postFormDataWithAuth(
        `${constants.facadeUrlBase}/observations/${this.theUuid}`,
        form => {
          form.set('projectId', this.$store.getters['obs/projectId'])
          form.set(
            'observation',
            new Blob([JSON.stringify(this.getObsBody())], {
              type: 'application/json',
            }),
          )
          for (let i = 1; i <= this.photoCount; i++) {
            form.append(
              'photos',
              new File([imgBytes], `image${i}.jpg`, { type: 'image/jpeg' }),
            )
          }
        },
        apiToken,
      )
      const jsonStr = JSON.stringify(await resp.json(), null, 2)
      this.outcome =
        `\nRun at: ${new Date().toISOString()}\n` +
        `status=${resp.status}\n` +
        jsonStr
    },
    async getImgBytes() {
      const resp = await fetch('img/help/orchid-type-terrestrial.jpg')
      return resp.arrayBuffer()
    },
    getObsBody() {
      if (!this.theUuid) {
        this.theUuid = uuid()
      }
      return {
        latitude: -35.01,
        longitude: 138.3309806,
        observed_on_string: new Date().toISOString(),
        species_guess: 'Erythrorchis',
        observation_field_values_attributes: {
          '0': { observation_field_id: 39, value: 'Terrestrial' },
          '1': { observation_field_id: 43, value: 'Not collected' },
          '2': { observation_field_id: 46, value: 'Not collected' },
          '3': { observation_field_id: 47, value: 'Not collected' },
          '4': { observation_field_id: 75, value: 'No' },
          '5': { observation_field_id: 76, value: 'No' },
          '6': { observation_field_id: 77, value: 'No' },
          '7': { observation_field_id: 78, value: 'No' },
          '8': { observation_field_id: 79, value: 'No' },
          '9': { observation_field_id: 80, value: 'No' },
          '10': { observation_field_id: 81, value: 'No' },
          '11': { observation_field_id: 102, value: 'No' },
          '12': { observation_field_id: 51, value: 'Exact' },
          '13': { observation_field_id: 53, value: 1 },
          '14': { observation_field_id: 50, value: 'Not collected' },
          '15': { observation_field_id: 111, value: 'Not collected' },
          '16': { observation_field_id: 63, value: 'No' },
          '17': { observation_field_id: 64, value: 'No' },
          '18': { observation_field_id: 65, value: 'No' },
          '19': { observation_field_id: 66, value: 'No' },
          '20': { observation_field_id: 67, value: 'No' },
          '21': { observation_field_id: 68, value: 'No' },
          '22': { observation_field_id: 62, value: 'Not collected' },
          '23': { observation_field_id: 59, value: 'Not collected' },
          '24': { observation_field_id: 103, value: 'No' },
          '25': { observation_field_id: 104, value: 'No' },
          '26': { observation_field_id: 105, value: 'No' },
          '27': { observation_field_id: 106, value: 'No' },
          '28': { observation_field_id: 107, value: 'No' },
          '29': { observation_field_id: 108, value: 'No' },
          '30': { observation_field_id: 109, value: 'No' },
          '31': { observation_field_id: 110, value: 'No' },
          '32': { observation_field_id: 99, value: 'Not collected' },
          '33': { observation_field_id: 100, value: 'Not collected' },
          '34': { observation_field_id: 101, value: 'Not collected' },
          '35': { observation_field_id: 200, value: 'Not collected' },
          '36': { observation_field_id: 114, value: 'No' },
          '37': { observation_field_id: 82, value: 'No' },
          '38': { observation_field_id: 83, value: 'No' },
          '39': { observation_field_id: 84, value: 'No' },
          '40': { observation_field_id: 85, value: 'No' },
          '41': { observation_field_id: 86, value: 'No' },
          '42': { observation_field_id: 94, value: 'No' },
          '43': { observation_field_id: 87, value: 'No' },
          '44': { observation_field_id: 88, value: 'No' },
          '45': { observation_field_id: 89, value: 'No' },
          '46': { observation_field_id: 90, value: 'No' },
          '47': { observation_field_id: 91, value: 'No' },
          '48': { observation_field_id: 92, value: 'No' },
          '49': { observation_field_id: 93, value: 'No' },
          '50': { observation_field_id: 95, value: 'No' },
          '51': { observation_field_id: 96, value: 'No' },
          '52': { observation_field_id: 97, value: 'No' },
        },
        description: null,
        positional_accuracy: null,
        captive_flag: false,
        geoprivacy: 'obscured',
        // reuse the same UUID until page reload to test clobbering logic
        uuid: this.theUuid,
      }
    },
  },
}
</script>

<style lang="scss" scoped>
#outcome {
  white-space: pre;
  font-family: monospace;
}
</style>
