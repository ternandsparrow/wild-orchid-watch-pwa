<template>
  <v-ons-page>
    <v-ons-list>
      <v-ons-list-header>Transitions</v-ons-list-header>
      <v-ons-list-item
        v-for="curr in animations"
        :key="curr.name"
        modifier="chevron"
        @click="transition(curr.name)"
      >
        {{ curr.name }}
      </v-ons-list-item>
    </v-ons-list>
  </v-ons-page>
</template>

<script>
import Vue from 'vue'

const transitionPage = {
  template: `
    <v-ons-page>
      <custom-toolbar backLabel="Anim">
        {{ animation }}
      </custom-toolbar>
      <p style="text-align: center">
        Use the VOnsBackButton
      </p>
    </v-ons-page>
    `,
}
const animations = [
  'none',
  'default',
  'slide-ios',
  'slide-md',
  'lift-ios',
  'lift-md',
  'fade-ios',
  'fade-md',
].map(e => {
  return {
    name: e,
    compiledTemplate: new Vue({
      extends: transitionPage,
      data() {
        return {
          animation: e,
        }
      },
    }),
  }
})

export default {
  data() {
    return {
      animations,
    }
  },
  methods: {
    transition(name) {
      // this.$store.commit('navigator/options', {
      //   // Sets animations
      //   animation: name,
      //   // Resets default options
      //   callback: () => this.$store.commit('navigator/options', {}),
      // })
      // FIXME this doesn't work but we're going to get rid of it anyway, doing runtime template
      // compilation isn't required.
      const compiledTemplate = this.animations.find(e => e.name === name)
        .compiledTemplate
      this.$store.commit('navigator/push', compiledTemplate)
    },
  },
}
</script>
