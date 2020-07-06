<template>
  <div class="main-container">
    <div ref="inputWrapper" class="input-status-wrapper">
      <v-ons-search-input
        v-model="theValue"
        class="the-input"
        float
        :placeholder="placeholderText"
        type="text"
        @keyup="onKeyup($event)"
        @focus="scrollSoAutocompleteItemsAreVisible"
        @blur="onBlur"
      >
      </v-ons-search-input>
      <wow-input-status
        :is-ok="isItemSelected"
        class="the-input-status"
      ></wow-input-status>
    </div>
    <div v-show="isShowSuggestions">
      <div class="autocomplete-title">{{ titleMsg }}:</div>
      <div class="autocomplete-list">
        <v-ons-list>
          <v-ons-list-item v-show="isNoItems">
            <div class="center text-center">
              <span class="list-item__title">
                <v-ons-icon icon="fa-info-circle" />
                No suggested taxa found
              </span>
              <span class="list-item__subtitle"
                >The species name you have typed will be used as-is</span
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
              <span class="list-item__title"
                ><a>{{ curr.preferredCommonName }}</a></span
              >
              <span class="list-item__subtitle">{{ curr.name }}</span>
            </div>
          </v-ons-list-item>
        </v-ons-list>
      </div>
    </div>
    <div v-show="isError" class="error-alert">
      Error while getting suggestions. You can still use your input as a
      placeholder.
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
    isError: Boolean,
  },
  data() {
    return {
      theValue: null,
      showItemsMasterSwitch: true,
      isDirty: false,
      isItemSelected: false,
      isWatchingInitialValue: true,
      runningMasterSwitchTimeoutId: null,
      isFocused: false,
    }
  },
  computed: {
    isShowSuggestions() {
      const isItems = !this.isNoItems
      const isInput = !!this.theValue
      return this.showItemsMasterSwitch && (isItems || isInput)
    },
    titleMsg() {
      return this.isDirty ? 'Available items' : 'Recently used'
    },
    isNoItems() {
      return (this.items || []).length === 0
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
    async onKeyup(event) {
      const theKey = event.key.toLowerCase()
      if (theKey === 'enter') {
        // this is for the Go/Done button on phone keyboards
        event.target.blur()
        return
      }
      const codesToSwallow = ['shift', 'alt', 'control']
      const isArrow = theKey.startsWith('arrow')
      if (codesToSwallow.includes(theKey) || isArrow) {
        return
      }
      this.$emit('change', {
        value: this.theValue,
        extra: this.extraCallbackData,
      })
      const isSearchTerm = !!this.theValue
      if (this.runningMasterSwitchTimeoutId) {
        clearTimeout(this.runningMasterSwitchTimeoutId)
        this.runningMasterSwitchTimeoutId = null
      }
      if (isSearchTerm) {
        // the searching of the taxa index is fast but not instant and as it's
        // triggered async, we need to add some delay to let the index search
        // complete, otherwise we'd show a flash of the "no results" message.
        const delayToLetIndexSearchFinish = 500
        this.runningMasterSwitchTimeoutId = setTimeout(() => {
          this.showItemsMasterSwitch = true
        }, delayToLetIndexSearchFinish)
      } else {
        this.showItemsMasterSwitch = false
      }
      this.isDirty = true
      this.isItemSelected = isSearchTerm
      this.useTypedValue()
      this.isWatchingInitialValue = false
    },
    onBlur() {
      this.isFocused = false
      setTimeout(() => {
        if (this.isFocused) {
          // user must have re-focused
          return
        }
        this.showItemsMasterSwitch = false
      }, 500)
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
    useTypedValue() {
      this.$emit('item-selected', {
        value: {
          name: this.theValue,
          preferredCommonName: this.theValue,
        },
        extra: this.extraCallbackData,
      })
    },
    scrollSoAutocompleteItemsAreVisible() {
      this.isFocused = true
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

.the-input-status {
  margin-left: 0.5em;
}

.error-alert {
  border: 1px solid red;
  border-radius: 5px;
  padding: 1em;
  margin-top: 0.5em;
  background: pink;
}
</style>
