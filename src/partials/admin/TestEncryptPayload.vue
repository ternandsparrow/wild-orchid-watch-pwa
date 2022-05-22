<template>
  <v-ons-card>
    <div class="title">
      Test encrypting a payload
    </div>
    <div v-if="!isShow">
      <v-ons-button @click="isShow = true">Show card content</v-ons-button>
    </div>
    <div v-if="isShow">
      <div>
        <p>
          Simply an easy way to get an encrypted payload to test out the other
          crypto features.
        </p>
      </div>
      <div>Public JWK to use</div>
      <p>
        <v-ons-button @click="useConfiguredPublicJwk"
          >Use configured public JWK</v-ons-button
        >
        <textarea v-model="publicJwkToImport" class="jwk-textarea"></textarea>
      </p>
      <div>Plain text to encode</div>
      <p>
        <textarea v-model="plainText" class="jwk-textarea"></textarea>
      </p>
      <v-ons-button @click="doEncryptPayload">Encrypt plain text</v-ons-button>
      <p>Encrypted payload result</p>
      <p>
        <textarea
          v-model="encryptedPayload"
          disabled
          class="jwk-textarea"
        ></textarea>
      </p>
    </div>
  </v-ons-card>
</template>

<script>
import { encryptAndBase64Encode } from '@/misc/no-deps-helpers'
import {
  cryptoConfig,
  publicJwk as configuredPublicJwk,
} from '@/misc/constants'

export default {
  name: 'TestEncryptPayload',
  data() {
    return {
      isShow: false,
      publicJwkToImport: null,
      encryptedPayload: null,
      plainText: 'Hello, World!',
    }
  },
  methods: {
    async doEncryptPayload() {
      if (!window.crypto.subtle) {
        throw new Error('No crypto support in browser')
      }
      const encryptedObj = await encryptAndBase64Encode(
        this.publicJwkToImport,
        this.plainText,
        cryptoConfig,
      )
      this.encryptedPayload = JSON.stringify(encryptedObj)
    },
    useConfiguredPublicJwk() {
      this.publicJwkToImport =
        configuredPublicJwk || '(no public JWK configured)'
    },
  },
}
</script>

<style lang="scss" scoped>
.jwk-textarea {
  height: 12em;
  width: 100%;
}
</style>
