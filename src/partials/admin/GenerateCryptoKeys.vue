<template>
  <v-ons-card>
    <div class="title">
      Generate a JWK key pair.
    </div>
    <div v-if="!isShow">
      <v-ons-button @click="isShow = true">Show card content</v-ons-button>
    </div>
    <div v-if="isShow">
      <div>
        <p>
          You should put the public key into the config of the deployed apps, so
          they can use it to encrypt things. You need to keep the private key
          somewhere safe so you can decrypt the encrypted things you receive.
          The app will not store the private key for you. You must store it and
          provide it when decrypting a payload (below).
        </p>
        <v-ons-button @click="generateJwk"
          >Generate JWKs (JSON web key)</v-ons-button
        >
      </div>
      <div>Public JWK</div>
      <div><a href="#" @click="copyPublicJwk">copy</a></div>
      <p>
        <textarea
          ref="publicJwk"
          v-model="prettyPublicJwk"
          disabled
          class="jwk-textarea"
        ></textarea>
      </p>
      <div>Private JWK</div>
      <div><a href="#" @click="copyPrivateJwk">copy</a></div>
      <p>
        <textarea
          ref="privateJwk"
          v-model="prettyPrivateJwk"
          disabled
          class="jwk-textarea"
        ></textarea>
      </p>
    </div>
  </v-ons-card>
</template>

<script>
import { cryptoConfig } from '@/misc/constants'

export default {
  name: 'GenerateCryptoKeys',
  data() {
    return {
      isShow: false,
      jwk: {},
    }
  },
  computed: {
    prettyPublicJwk() {
      const val = this.jwk.publicJwk
      if (!val) {
        return '(no key pair generated yet)'
      }
      return JSON.stringify(val)
    },
    prettyPrivateJwk() {
      const val = this.jwk.privateJwk
      if (!val) {
        return '(no key pair generated yet)'
      }
      return JSON.stringify(val)
    },
  },
  methods: {
    async generateJwk() {
      if (!window.crypto.subtle) {
        throw new Error('No crypto support in browser')
      }
      console.log('Generating key pair')
      const keyPair = await window.crypto.subtle.generateKey(
        {
          ...cryptoConfig.rsaParams,
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
        },
        true,
        ['encrypt', 'decrypt'],
      )
      const publicJwk = await window.crypto.subtle.exportKey(
        'jwk',
        keyPair.publicKey,
      )
      const privateJwk = await window.crypto.subtle.exportKey(
        'jwk',
        keyPair.privateKey,
      )
      this.jwk = {
        publicJwk,
        privateJwk,
      }
    },
    copyPublicJwk() {
      const element = this.$refs.publicJwk
      element.disabled = false
      element.select()
      element.setSelectionRange(0, 99999)
      document.execCommand('copy')
      element.disabled = true
    },
    copyPrivateJwk() {
      const element = this.$refs.privateJwk
      element.disabled = false
      element.select()
      element.setSelectionRange(0, 99999)
      document.execCommand('copy')
      element.disabled = true
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
