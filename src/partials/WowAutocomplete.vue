<template>
  <div class="main-container">
    <div ref="inputWrapper" class="search-wrapper">
      <v-ons-search-input
        v-model="theValue"
        class="the-input"
        float
        :placeholder="placeholderText"
        type="text"
        @keyup="onKeyup"
        @focus="scrollSoAutocompleteItemsAreVisible"
      >
      </v-ons-search-input>
      <div class="input-status">
        <v-ons-icon
          v-if="isItemSelected"
          class="success"
          icon="fa-check-circle"
        ></v-ons-icon>
        <v-ons-icon
          v-if="!isItemSelected"
          class="warning"
          icon="fa-exclamation-circle"
        ></v-ons-icon>
      </div>
    </div>
    <div v-show="isShowSuggestions">
      <div class="autocomplete-title">{{ titleMsg }}:</div>
      <div class="autocomplete-list">
        <v-ons-list>
          <v-ons-list-item v-if="theValue" @click="onSelectPlaceholder()">
            <div class="left">
              <div class="list-item__thumbnail placeholder-image-wrapper">
                <v-ons-icon icon="fa-search"></v-ons-icon>
              </div>
            </div>
            <div class="center">
              <span class="list-item__title">
                Use "<em>{{ theValue }}</em
                >" as a Field Name </span
              ><span class="list-item__subtitle"
                >Force use of your own term</span
              >
            </div>
          </v-ons-list-item>
          <v-ons-list-item
            v-for="curr of items"
            :key="curr.name"
            @click="onSelect(curr)"
          >
            <div class="left">
              <img
                v-if="curr.photoUrl"
                class="list-item__thumbnail"
                :src="curr.photoUrl"
              />
              <div
                v-if="!curr.photoUrl"
                class="list-item__thumbnail placeholder-image-wrapper"
              >
                <v-ons-icon icon="fa-leaf"></v-ons-icon>
              </div>
            </div>
            <div class="center">
              <span class="list-item__title">{{
                curr.preferredCommonName
              }}</span>
              <span class="list-item__subtitle">{{ curr.name }}</span>
            </div>
          </v-ons-list-item>
        </v-ons-list>
      </div>
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
      isDirty: false,
      isItemSelected: false,
      isWatchingInitialValue: true,
    }
  },
  computed: {
    isShowSuggestions() {
      const isItems = (this.items || []).length > 0
      const isInput = !!this.theValue
      return this.showItemsMasterSwitch && (isItems || isInput)
    },
    titleMsg() {
      return this.isDirty ? 'Available items' : 'Recently used'
    },
  },
  watch: {
    initialValue(newVal) {
      // it seems we need to watch the input, in addition to handling it in
      // beforeMount(). There is a race condition where the initial value
      // input isn't set when this component is mounted, as we're still waiting
      // on data from the network. At some point, we want to stop watching it
      // otherwise we could get a feedback loop between the event we emit on item
      // selection and it coming back in via the initial value.
      if (!this.isWatchingInitialValue) {
        return
      }
      this.onInitialValueSet(newVal)
    },
  },
  beforeMount() {
    this.onInitialValueSet(this.initialValue)
  },
  methods: {
    onInitialValueSet(newVal) {
      this.theValue = newVal
      if (this.theValue) {
        this.showItemsMasterSwitch = false
        this.isItemSelected = true
      }
    },
    async onKeyup() {
      this.$emit('change', {
        value: this.theValue,
        extra: this.extraCallbackData,
      })
      this.showItemsMasterSwitch = true
      this.isDirty = true
      this.isItemSelected = false
      this.$emit('item-selected', {
        value: null,
        extra: this.extraCallbackData,
      })
      this.isWatchingInitialValue = false
    },
    onSelect(selectedItem) {
      this.theValue = selectedItem.preferredCommonName
      this.isItemSelected = true
      this.isWatchingInitialValue = false
      this.$emit('item-selected', {
        value: selectedItem,
        extra: this.extraCallbackData,
      })
      this.showItemsMasterSwitch = false
    },
    onSelectPlaceholder() {
      this.onSelect({
        name: this.theValue,
        preferredCommonName: this.theValue,
      })
    },
    scrollSoAutocompleteItemsAreVisible() {
      const delayForOnscreenKeyboardToAppear = 400
      setTimeout(() => {
        this.$refs.inputWrapper.scrollIntoView({ behavior: 'smooth' })
      }, delayForOnscreenKeyboardToAppear)
    },
  },
}
</script>

<style lang="scss" scoped>
.main-container {
  width: 100%;
}

.the-input {
  width: 90%;
}

.autocomplete-title {
  margin-top: 1em;
  border: 1px solid #ccc;
  text-align: center;
  font-style: italic;
  font-size: 0.9em;
  color: #484848;
  border-top-right-radius: 5px;
  border-top-left-radius: 5px;
}

.autocomplete-list {
  max-height: 15em;
  overflow-y: auto;
  border: 1px solid #ccc;
  border-top: none;
}

.placeholder-image-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.search-wrapper {
  display: flex;
  align-items: center;
  flex-direction: row;
  padding-top: 0.5em;

  .input-status {
    margin-left: 0.5em;
  }
}

.success {
  color: green;
}

.warning {
  color: red;
}
</style>
