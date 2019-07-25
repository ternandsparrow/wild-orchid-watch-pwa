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
      <div>{{ userEmail }}</div>
    </div>
    <v-ons-list>
      <v-ons-list-item
        v-for="(item, index) in access"
        :key="item.title"
        :modifier="md ? 'nodivider' : ''"
        @click="loadView(index)"
      >
        <div class="left">
          <v-ons-icon
            fixed-width
            class="list-item__icon"
            :icon="item.icon"
          ></v-ons-icon>
        </div>
        <div class="center">
          {{ item.title }}
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
          {{ item.title }}
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
import Activity from '@/pages/activity/index'
import Missions from '@/pages/missions/index'
import Settings from '@/pages/Settings'
import { appVersion, isDeployedToProd } from '@/misc/constants'

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
          icon: 'ion-leaf',
          url:
            'https://www.inaturalist.org/projects/wild-orchid-watch-australia-beta',
        },
        {
          title: 'Instagram',
          icon: 'ion-social-instagram',
          url: 'http://instagram.com/wildorchidwatch',
        },
        {
          title: 'Twitter',
          icon: 'ion-social-twitter',
          url: 'https://twitter.com/wildorchidwatch',
        },
        {
          title: 'Facebook',
          icon: 'ion-social-facebook',
          url: 'https://www.facebook.com/WildOrchidWatch/',
        },
      ],
      access: [
        {
          title: 'My observations',
          icon: 'ion-home, material:md-home',
          component: Observations,
        },
        {
          title: 'Missions',
          icon: 'md-compass',
          component: Missions,
        },
        {
          title: 'Activity',
          icon: 'md-accounts-alt',
          component: Activity,
        },
        {
          title: 'Settings',
          icon: 'md-settings',
          component: Settings,
        },
      ],
    }
  },
  computed: {
    ...mapGetters('auth', ['userEmail', 'userIcon']),
    deployedEnvName() {
      return isDeployedToProd ? '' : '[development build]'
    },
  },
  methods: {
    loadView(index) {
      const component = this.access[index].component
      this.$store.commit('navigator/pushInnerPage', component)
      this.$store.commit('splitter/toggle')
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
      this.$router.push({ name: 'Admin' })
      this.$store.commit('splitter/toggle')
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
}
</style>
