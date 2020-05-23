<template>
  <v-ons-page modifier="white">
    <div
      class="is-dev-warning"
      :class="{ 'force-hide': isForceHideDevWarning }"
      @click="onDevWarningClick"
    >{{ deployedEnvName }}</div>
    <div class="app-banner centered-flex-row">
      <img src="../assets/wow-logo.png" />
      <div>
        <div>Wild Orchid Watch</div>
        <div class="version-number" @click="onVersionClick">Version: {{ appVersion }}</div>
      </div>
    </div>
    <div class="profile-pic centered-flex-row">
      <img :src="userIcon" />
      <div>{{ myUsername }}</div>
    </div>
    <v-ons-list>
      <v-ons-list-item
        v-for="item in enabledAccess"
        :key="item.title"
        :modifier="md ? 'nodivider' : ''"
        @click="handleMenuClick(item.target)"
      >
        <div class="left">
          <v-ons-icon fixed-width class="list-item__icon" :icon="item.icon"></v-ons-icon>
        </div>
        <div class="center">
          <a>{{ item.title }}</a>
        </div>
      </v-ons-list-item>
    </v-ons-list>

    <v-ons-list-title>Links</v-ons-list-title>
    <v-ons-list>
      <v-ons-list-item v-for="item in links" :key="item.title" :modifier="md ? 'nodivider' : ''">
        <div class="left">
          <v-ons-icon fixed-width class="list-item__icon" :icon="item.icon"></v-ons-icon>
        </div>
        <div class="center">
          <a :href="item.url" target="_blank" class="external-link">
            {{ item.title }}
          </a>
        </div>
        <div class="right">
          <v-ons-icon icon="fa-external-link"></v-ons-icon>
        </div>
      </v-ons-list-item>
    </v-ons-list>
  </v-ons-page>
</template>

<script>
import { mapGetters } from 'vuex'

import {
  appVersion,
  deployedEnvName,
  inatUrlBase,
  inatProjectSlug,
  isMissionsFeatureEnabled,
  isNewsFeatureEnabled,
  isSearchFeatureEnabled,
} from '@/misc/constants'

export default {
  data() {
    return {
      appVersion,
      isForceHideDevWarning: false,
      versionClickCount: 0,
      versionClickEasterEggTimeout: null,
      links: [
        {
          title: 'WOW Site',
          icon: 'md-globe-alt',
          url: 'https://www.wildorchidwatch.org/',
        },
        {
          title: 'iNaturalist',
          icon: 'fa-leaf',
          url: `${inatUrlBase}/projects/${inatProjectSlug}`,
        },
        {
          title: 'Instagram',
          icon: 'ion-logo-instagram',
          url: 'http://instagram.com/wildorchidwatch',
        },
        {
          title: 'Twitter',
          icon: 'ion-logo-twitter',
          url: 'https://twitter.com/wildorchidwatch',
        },
        {
          title: 'Facebook',
          icon: 'ion-logo-facebook',
          url: 'https://www.facebook.com/WildOrchidWatch/',
        },
      ],
      access: [
        {
          title: 'My Observations',
          icon: 'fa-microscope',
          target: { name: 'Home' },
        },
        {
          title: 'My Gallery',
          icon: 'fa-images',
          target: { name: 'Gallery' },
        },
        {
          title: 'My Species',
          icon: 'fa-leaf',
          target: { name: 'Species' },
        },
        {
          title: 'News',
          icon: 'fa-newspaper',
          target: { name: 'News' },
          isDisabled: !isNewsFeatureEnabled,
        },
        {
          title: 'Search',
          icon: 'fa-search',
          target: { name: 'Search' },
          isDisabled: !isSearchFeatureEnabled,
        },
        {
          title: 'Missions',
          icon: 'fa-search-location',
          target: { name: 'Missions' },
          isDisabled: !isMissionsFeatureEnabled,
        },
        {
          title: 'Orchid Science',
          icon: 'fa-book-open',
          target: { name: 'OrchidScience' },
        },
        {
          title: 'FAQs',
          icon: 'fa-info',
          target: { name: 'FAQ' },
        },
        {
          title: 'Help',
          icon: 'fa-question-circle',
          target: { name: 'HelpPage' },
        },
        {
          title: 'Settings',
          icon: 'md-settings',
          target: { name: 'Settings' },
        },
      ],
    }
  },
  computed: {
    ...mapGetters('auth', ['userEmail', 'myUsername', 'userIcon']),
    deployedEnvName() {
      if (deployedEnvName === 'production') {
        return ''
      }
      return `[${deployedEnvName} build]`
    },
    enabledAccess() {
      return this.access.filter(e => !e.isDisabled)
    },
  },
  methods: {
    handleMenuClick(target) {
      this.safelyPushRoute(target)
    },
    onDevWarningClick() {
      this.isForceHideDevWarning = true
    },
    onVersionClick() {
      // like Android's easter egg, tap the version N times
      const tapCountThreshold = 7
      if (this.versionClickEasterEggTimeout) {
        clearTimeout(this.versionClickEasterEggTimeout)
      }
      this.versionClickEasterEggTimeout = setTimeout(() => {
        this.versionClickCount = 0
        this.versionClickEasterEggTimeout = null
      }, 1000)
      this.versionClickCount += 1
      if (this.versionClickCount < tapCountThreshold) {
        return
      }
      this.$wow.uiTrace('Admin', `open via easter egg`)
      this.safelyPushRoute({ name: 'Admin' })
    },
    async safelyPushRoute(routeTarget) {
      this.$store.commit('ephemeral/toggleSplitter')
      await this.$nextTick()
      // WOW-188 we need to wait for the nextTick so the DOM updates which
      // means the splitter updates it's internal state because it sees the
      // new value from Vuex. If you don't wait, we navigate before the
      // splitter updates and on iOS, that means there's a class added to
      // the body to "fix" scrolling but that means you cannot scroll
      this.$router.push(routeTarget)
    },
  },
}
</script>

<style scoped>
.app-banner {
  background-color: #fff;
  border-bottom: 1px solid #ccc;
}

.app-banner img {
  margin: 3px 5px;
}

.profile-pic img {
  border-radius: 50%;
  margin: 0.25em 0.5em;
}

.version-number {
  color: #747474;
  font-size: 0.8em;
  text-align: center;
}

.is-dev-warning {
  text-align: center;
  color: white;
  background-color: red;
  font-family: monospace;
}

.centered-flex-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  overflow: hidden; /* FIXME email addresses overflow the menu, maybe elipses
  them? */
}

.external-link {
  color: inherit;
  text-decoration: none;
}

.force-hide {
  display: none;
}
</style>
