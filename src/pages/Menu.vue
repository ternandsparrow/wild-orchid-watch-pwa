<template>
  <v-ons-page modifier="white">
    <div class="profile-pic">
      <img src="../assets/wow-logo.png" />
      <div class="app-name">Wild Orchid Watch</div>
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
    <div class="version-info" @click="onVersionClick">
      Version: {{ appVersion }}
    </div>
  </v-ons-page>
</template>

<script>
import Observations from '@/pages/obs/index'
import Activity from '@/pages/activity/index'
import Missions from '@/pages/missions/index'
import Settings from '@/pages/Settings'
import Admin from '@/pages/Admin'
import { appVersion } from '@/misc/constants'

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
  methods: {
    loadView(index) {
      const component = this.access[index].component
      this.$store.commit('app/pushInnerPage', component)
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
      this.$store.commit('navigator/push', Admin)
      this.$store.commit('splitter/toggle')
    },
  },
}
</script>

<style scoped>
.profile-pic {
  width: 100%;
  background-color: #fff;
  border-bottom: 1px solid #ddd;
  color: rgba(0, 0, 0, 0.56);
}

.page--material .profile-pic {
  background-color: #f6f6f6;
}

.profile-pic > img {
  max-width: 100%;
  margin: 5px;
}

.profile-pic > .app-name {
  vertical-align: bottom;
  line-height: 57px; /* FIXME should be dynamic from img */
  display: inline-block;
  margin-left: 1em;
}

.version-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  text-align: center;
  padding: 1em;
}
</style>
