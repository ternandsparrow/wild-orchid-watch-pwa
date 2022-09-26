<template>
  <div class="tabbar-fixer">
    <v-ons-tabbar
      :tabs="tabsWithPlaceholderPages"
      :visible="true"
      :index.sync="index"
      :tabbar-style="tabStyle"
    >
      <template slot="pages"></template>
    </v-ons-tabbar>
  </div>
</template>

<script>
/*
 * We want a tabbar that looks and operates like a real tabbar
 * but the <v-ons-tabbar> component goes full screen and we
 * don't want that. So we hijack the onsen component and "fix"
 * it so it does go inline. We break it's ability to show content
 * so we handle that ourselves.
 */
export default {
  name: 'RelativeTabbar',
  props: {
    tabs: {
      type: Array,
      required: true,
    },
    tabIndex: {
      type: Number,
    },
  },
  data() {
    return {
      index: 0,
      tabStyle: {
        position: 'relative',
      },
    }
  },
  computed: {
    tabsWithPlaceholderPages() {
      return this.tabs.map((e) => {
        e.page = { render: (h) => h('v-ons-page') }
        return e
      })
    },
  },
  watch: {
    index() {
      // TODO why doesn't :tab-index.sync="" work on this component?
      this.$emit('update:tabIndex', this.index)
    },
  },
  created() {
    this.index = this.tabIndex
  },
}
</script>

<style scoped>
.tabbar-fixer ons-tabbar {
  position: relative;
}
</style>
