<template>
  <div class="main-container">
    <div>
      <v-ons-input
        v-model="theValue"
        class="the-input"
        float
        :placeholder="placeholderText"
        type="text"
        @keyup="onKeyup"
        @focus="onFocus"
      >
      </v-ons-input>
    </div>
    <div v-show="isShowSuggestions">
      <ul class="autocomplete-list">
        <li v-if="theValue" @click="onSelect(theValue)">
          Use "<em>{{ theValue }}</em
          >" as a placeholder
        </li>
        <li v-for="curr of items" :key="curr.id" @click="onSelect(curr.name)">
          {{ curr.name }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
export default {
  name: 'WowAutocomplete',
  props: {
    placeholderText: String,
    initialValue: String,
    items: Array,
    extraCallbackData: Number,
  },
  data() {
    return {
      theValue: null,
      showItemsMasterSwitch: true,
    }
  },
  computed: {
    isShowSuggestions() {
      const isItems = (this.items || []).length > 0
      const isInput = (this.theValue || '').trim().length > 0
      return this.showItemsMasterSwitch && (isItems || isInput)
    },
  },
  mounted() {
    this.theValue = this.initialValue
  },
  methods: {
    async onKeyup() {
      this.$emit('change', {
        value: this.theValue,
        extra: this.extraCallbackData,
      })
      this.showItemsMasterSwitch = true
    },
    onSelect(selected) {
      this.theValue = selected
      this.$emit('item-selected', {
        value: this.theValue,
        extra: this.extraCallbackData,
      })
      this.showItemsMasterSwitch = false
    },
    onFocus() {
      // FIXME scroll input to top-ish of page, something like
      // const pc = document.getElementsByClassName('page__content')[0] // a ref would be better
      // const theInput = ... (needs a ref or something)
      // pc.scrollTo(0, theInput.getBoundingClientRect().top - pc.getBoundingClientRect().top)
    },
  },
}
</script>

<style lang="scss">
.main-container {
  width: 100%;
}

.the-input {
  width: 90vw;
}

.autocomplete-list {
  list-style: none;
  max-height: 15em;
  overflow-y: auto;
  padding-left: 1em;
  padding-right: 1em;

  li {
    margin: 1em auto;
    border-bottom: 1px solid #ccc;
  }
}
</style>
