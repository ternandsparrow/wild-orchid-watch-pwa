<template>
  <v-ons-page>
    <v-ons-list>
      <v-ons-list-header>
        <div>
          <div>
            <v-ons-icon icon="fa-wrench" class="list-item__icon"></v-ons-icon>
          </div>
          <div>
            [WIP] - This page will contain a FAQ as we collect them...!
          </div>
        </div>
      </v-ons-list-header>

      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title">[#1]: How do I.... ?</span
          ><span class="list-item__subtitle">It is simplest to...</span>
        </div>
      </v-ons-list-item>
      <v-ons-list-item>
        <div class="center">
          <span class="list-item__title"
            >[#2]: Should I always collect... ?</span
          ><span class="list-item__subtitle"
            >No, it is only necessary to..</span
          >
        </div>
      </v-ons-list-item>
    </v-ons-list>
  </v-ons-page>
</template>

<script>
export default {
  name: 'FAQ',
  data() {
    return {}
  },
  mounted() {
    this.$store.commit('app/setTopTitle', 'FAQ')
  },
}
</script>
