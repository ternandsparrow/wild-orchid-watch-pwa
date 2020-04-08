<template>
  <v-ons-page modifier="white">
    <div class="is-dev-warning">{{ deployedEnvName }}</div>
    <div class="app-banner centered-flex-row">
      <img src="../assets/wow-logo.png" />
      <div>
        <div>Wild Orchid Watch</div>
        <div class="version-number" @click="onVersionClick">
          Version: {{ appVersion }}
        </div>
      </div>
    </div>
    <div class="profile-pic centered-flex-row">
      <img :src="userIcon" />
      <div>{{ myUsername }}</div>
    </div>
    <v-ons-list>
      <v-ons-list-item
        v-for="item in access"
        :key="item.title"
        :modifier="md ? 'nodivider' : ''"
        @click="handleMenuClick(item.clickData)"
      >
        <div class="left">
          <v-ons-icon
            fixed-width
            class="list-item__icon"
            :icon="item.icon"
          ></v-ons-icon>
        </div>
        <div class="center">
          <a>{{ item.title }}</a>
        </div>
      </v-ons-list-item>
    </v-ons-list>

    <v-ons-list-title>Links</v-ons-list-title>
    <v-ons-list>
      <v-ons-list-item
        v-for="item in links"
        :key="item.title"
        :modifier="md ? 'nodivider' : ''"
        @click="loadLink(item.url)"
      >
        <div class="left">
          <v-ons-icon
            fixed-width
            class="list-item__icon"
            :icon="item.icon"
          ></v-ons-icon>
        </div>
        <div class="center">
          <a>{{ item.title }}</a>
        </div>
        <div class="right">
          <v-ons-icon icon="fa-external-link"></v-ons-icon>
        </div>
      </v-ons-list-item>
    </v-ons-list>
    <!-- FIXME could add "New observation" at bottom like iNat -->
  </v-ons-page>
</template>

<script>
import { mapGetters } from 'vuex'

import Observations from '@/pages/obs/index'
// import Activity from '@/pages/activity/index'
// import Dashboard from '@/pages/dashboard/index'
import {
  appVersion,
  deployedEnvName,
  inatUrlBase,
  inatProjectSlug,
} from '@/misc/constants'
import { innerPageStackReplace } from '@/misc/nav-stacks'

const componentType = 'COMPONENT'
const routerType = 'ROUTER'

export default {
  data() {
    return {
      appVersion,
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
        // {
        //   title: 'Dashboard',
        //   icon: 'fa-tachometer-alt',
        //   component: Dashboard,
        // },
        {
          title: 'My Observations',
          icon: 'fa-microscope',
          clickData: {
            type: componentType,
            component: Observations,
          },
        },
        // FIXME uncomment when they have real content
        // {
        //   title: 'Activity',
        //   icon: 'md-accounts-alt',
        //   component: Activity,
        // },
        {
          title: 'Orchid Science',
          icon: 'fa-book-open',
          clickData: {
            type: routerType,
            target: { name: 'OrchidScience' },
          },
        },
        {
          title: 'FAQ',
          icon: 'fa-info',
          clickData: {
            type: routerType,
            target: { name: 'FAQ' },
          },
        },
        {
          title: 'Help',
          icon: 'fa-question-circle',
          clickData: {
            type: routerType,
            target: { name: 'HelpPage' },
          },
        },
        {
          title: 'Settings',
          icon: 'md-settings',
          clickData: {
            type: routerType,
            target: { name: 'Settings' },
          },
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
  },
  methods: {
    handleMenuClick(clickData) {
      switch (clickData.type) {
        case componentType:
          this.$store.commit('ephemeral/toggleSplitter')
          return this.loadView(clickData.component)
        case routerType:
          this.safelyPushRoute(clickData.target)
          return
        default:
          throw new Error(
            `Programmer problem: unhandled clickData=${clickData}`,
          )
      }
    },
    loadView(component) {
      innerPageStackReplace(component) // TODO are we happy with no back for these pages?
    },
    loadLink(url) {
      window.open(url, '_blank')
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
</style>
