<template>
  <v-ons-card>
    <div class="title">
      Decrypt encrypted payload
    </div>
    <div v-if="!isShow">
      <v-ons-button @click="isShow = true">Show card content</v-ons-button>
    </div>
    <div v-if="isShow">
      <div>
        <p>
          You have a payload that you need to decrypt. You will also need the
          private key to decrypt it. This key would've come from the section
          above. You need to provide this private key, it is
          <em>not stored in the app for you</em>.
        </p>
      </div>
      <div>Private JWK to use</div>
      <p>
        <textarea v-model="privateJwkToImport" class="jwk-textarea"></textarea>
      </p>
      <div>Encrypted payload</div>
      <p>
        <textarea
          v-model="encryptedPayload"
          class="jwk-textarea"
          :placeholder="examplePayload"
        ></textarea>
      </p>
      <v-ons-button @click="doDecryptPayload">Decrypt payload</v-ons-button>
      <p>Decrypted payload result</p>
      <p>
        <textarea
          v-model="decryptedPayload"
          disabled
          class="jwk-textarea"
        ></textarea>
      </p>
    </div>
  </v-ons-card>
</template>

<script>
import { base64DecodeAndDecrypt } from '@/misc/no-deps-helpers'
import { cryptoConfig } from '@/misc/constants'

export default {
  name: 'DecryptPayload',
  data() {
    return {
      isShow: false,
      privateJwkToImport: null,
      encryptedPayload: null,
      decryptedPayload: null,
      examplePayload: '{"payload":"aBc123==","symKeyBundle":"aBc123=="}',
    }
  },
  methods: {
    async doDecryptPayload() {
      if (!window.crypto.subtle) {
        throw new Error('No crypto support in browser')
      }
      this.decryptedPayload = await base64DecodeAndDecrypt(
        this.privateJwkToImport,
        this.encryptedPayload,
        cryptoConfig,
      )
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
