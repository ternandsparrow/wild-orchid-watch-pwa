<template>
  <v-ons-card>
    <div class="title">Configuration</div>
    <div v-if="!isShow">
      <v-ons-button @click="isShow = true">Show card content</v-ons-button>
    </div>
    <v-ons-list v-if="isShow">
      <template v-for="curr of configItems">
        <v-ons-list-header
          :key="curr.label + '-header'"
          class="wow-list-header wow-admin-list-header"
        >
          {{ curr.label }}
        </v-ons-list-header>
        <v-ons-list-item :key="curr.label + '-value'" class="config-item-value">
          {{ curr.value }}
        </v-ons-list-item>
      </template>
    </v-ons-list>
  </v-ons-card>
</template>

<script>
import * as cc from '@/misc/constants'

export default {
  name: 'ConfigurationDump',
  data() {
    return {
      isShow: false,
      configItems: [],
    }
  },
  created() {
    this.computeConfigItems()
  },
  methods: {
    computeConfigItems() {
      const nonSecretKeys = [
        'appVersion',
        'bboxLatMax',
        'bboxLatMin',
        'bboxLonMax',
        'bboxLonMin',
        'countOfIndividualsObsFieldDefault',
        'deployedEnvName',
        'inatProjectSlug',
        'inatStaticUrlBase',
        'inatUrlBase',
        'isForceVueDevtools',
        'isMissionsFeatureEnabled',
        'isNewsFeatureEnabled',
        'isDraftFeatureEnabled',
        'isBugReportFeatureEnabled',
        'maxReqFailureCountInSw',
        'maxSpeciesAutocompleteResultLength',
        'obsFieldNamePrefix',
        'obsFieldSeparatorChar',
        'redirectUri',
        'taxaDataUrl',
        'waitBeforeRefreshSeconds',
      ]
      const partialResult = nonSecretKeys.map((e) => ({
        label: e,
        value: cc[e],
      }))
      const result = [
        ...partialResult,
        { label: 'appId', value: cc.appId.replace(/.{35}/, '(snip)') },
        {
          label: 'googleMapsApiKey',
          value: ((v) => v.replace(new RegExp(`.{${v.length - 4}}`), '(snip)'))(
            cc.googleMapsApiKey,
          ),
        },
        {
          label: 'sentryDsn',
          value: cc.sentryDsn.replace(/.{25}/, '(snip)'),
        },
      ]
      result.sort((a, b) => {
        if (a.label < b.label) return -1
        if (a.label > b.label) return 1
        return 0
      })
      this.configItems = result
    },
  },
}
</script>

<style lang="scss" scoped></style>
