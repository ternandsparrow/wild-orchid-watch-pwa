<template>
  <div class="help-container">
    <v-ons-list>
      <v-ons-list-item modifier="nodivider">
        On this page you'll find help for the whole WOW app. There are help
        buttons throughout the app that will take you directly to the relevant
        section.
      </v-ons-list-item>
      <template v-for="currSection of sections">
        <v-ons-list-header
          :ref="currSection.id"
          :key="currSection.heading"
          class="wow-list-header"
          >{{ currSection.heading }}</v-ons-list-header
        >
        <v-ons-list-item
          v-for="(currValue, $index) of currSection.values"
          :key="currSection.heading + '-' + $index"
          modifier="nodivider"
        >
          <div class="help-value-item">
            <div v-if="!currValue.imageUrl" class="no-help-image-text">
              (No image available)
            </div>
            <div v-else-if="currValue.imageUrl.endsWith('blank')"></div>
            <div v-else-if="currValue.imageUrl">
              <img :src="currValue.imageUrl" class="help-image" />
            </div>
            <div>
              <strong>{{ currValue.value }}</strong>
            </div>
            <div>{{ currValue.helpText }}</div>
          </div>
        </v-ons-list-item>
      </template>
    </v-ons-list>
    <div class="padding-so-fab-doesnt-cover-text"></div>
    <v-ons-fab
      v-if="!hideCloseBtn"
      position="bottom center"
      :class="{ 'be-visible-on-ios': !md }"
      @click="doClose"
    >
      <a><v-ons-icon icon="fa-times"></v-ons-icon></a>
    </v-ons-fab>
  </div>
</template>

<script>
import helpData from '@/misc/help-structure'

export default {
  name: 'Help',
  props: {
    hideCloseBtn: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      sections: helpData,
    }
  },
  methods: {
    doClose() {
      this.$emit('close')
    },
    scrollToSection(sectionName) {
      const theRef = this.$refs[sectionName]
      if (!theRef) {
        console.warn(
          `Programmer error: No help section with name='${sectionName}' found`,
        )
        return
      }
      const theElement = theRef[0].$el
      if (!theElement) {
        console.warn(
          `Programmer problem: no section with ref='${sectionName}'` +
            `found cannot scroll without target`,
        )
        return
      }
      theElement.scrollIntoView({ behavior: 'smooth' })
    },
  },
}
</script>

<style scoped>
.help-container {
  width: 100vw;
  height: 100vh;
  color: black;
  background-color: white;
  overflow-y: auto;
}

.padding-so-fab-doesnt-cover-text {
  height: 80vh;
}

.help-value-item {
  flex-direction: column;
  align-items: stretch;
}

.no-help-image-text {
  color: #666;
}

.help-image {
  border-radius: 25px;
  box-shadow: 5px 5px 8px #888888;
  margin: 20px;
  max-width: 90vw;
}

.be-visible-on-ios {
  bottom: 120px;
}
</style>
