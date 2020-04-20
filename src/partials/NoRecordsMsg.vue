<template>
  <div class="no-records-msg">{{ fragment }}, so far..</div>
</template>

<script>
export default {
  name: 'NoRecordsMsg',
  props: {
    fragment: {
      type: String,
      required: true,
    },
  },
}
</script>

<style lang="scss" scoped>
.no-records-msg {
  color: #666;
  text-align: center;
  margin: 1.5em 1em;
}
</style>
