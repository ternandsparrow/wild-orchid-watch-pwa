<template>
  <div>
    <v-ons-icon v-if="isOk" class="success" icon="fa-check-circle"></v-ons-icon>
    <v-ons-icon
      v-if="!isOk"
      class="warning"
      icon="fa-exclamation-circle"
    ></v-ons-icon>
  </div>
</template>

<script>
export default {
  name: 'WowInputStatus',
  props: {
    isOk: Boolean,
  },
}
</script>

<style lang="scss" scoped>
.success {
  color: green;
}

.warning {
  color: red;
}
</style>
