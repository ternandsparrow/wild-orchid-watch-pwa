<template>
  <v-ons-list-header class="wow-list-header">
    <span v-if="helpTarget" class="help-trigger" @click="triggerHelp">
      <a><v-ons-icon icon="fa-question-circle"></v-ons-icon> Help</a></span
    >
    {{ label }}
    <wow-required-chip v-if="required" />
  </v-ons-list-header>
</template>

<script>
export default {
  name: 'WowHeader',
  props: {
    label: String,
    helpTarget: [String, Number],
    required: Boolean,
  },
  methods: {
    triggerHelp() {
      this.$emit('on-help', this.helpTarget)
    },
  },
}
</script>

<style scoped lang="scss">
.help-trigger {
  float: right;
}

.required {
  color: red;
}
</style>
