<template>
  <v-ons-page>
    <custom-toolbar back-label="Home" title="Orchid Science" />
    <v-ons-list>
      <v-ons-list-header
        >This page will contain information on the science which is enabled by
        the collected Observations..
      </v-ons-list-header>
      <ons-list-item>
        <label class="center">
          Wild Orchid Watch (WOW) is a national citizen science, orchid data
          collection project. An online platform incorporating an app, website
          and database to enable researchers, native orchid enthusiasts and
          citizen scientists to upload and identify orchid observations. The WOW
          app will guide users to make a series of observations in the field,
          collecting information designed to be of maximum relevance to
          scientists, such as photographs, habitat details and location.
        </label>
      </ons-list-item>
      <ons-list-item>
        <label class="center">
          Australia has the world's most diverse terrestrial orchid flora.
          However, our native orchids are highly susceptible to environmental
          change and account for 17% of nationally threatened plant species.
          Recent studies highlight climate change, florivory (animals eating the
          flowers), altered fire regimes and pollination deficits as stressors
          that are contributing to orchid decline, and many questions on their
          taxonomy and ecology remain unanswered. Orchids are often cryptic,
          population sizes and short flowering times vary with season, and they
          are sporadically distributed across Australia, making it difficult to
          obtain data using traditional methods.
        </label>
      </ons-list-item>
      <ons-list-item>
        <label class="center">
          This program builds on the growing momentum for citizen science in
          Australia, harnessing the knowledge and expertise of orchid
          enthusiasts who are keen to get involved. Data collected by citizen
          scientists using the WOW app will allow researchers to understand the
          value of orchids as indicators of environmental change, as well as
          provide fundamental information on orchid distribution, abundance, and
          phenology (life cycle events; emergence, flowering, fruiting), all of
          which are critical to understanding their complex taxonomy and
          assigning conservation status.
        </label>
      </ons-list-item>
    </v-ons-list>
  </v-ons-page>
</template>

<script>
export default {
  name: 'Dashboard',
  data() {
    return {}
  },
  mounted() {
    this.$store.commit('app/setTopTitle', 'Orchid Science')
  },
}
</script>
