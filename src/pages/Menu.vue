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
  </v-ons-page>
</template>

<script>
import Observations from './obs/index'
import Activity from './activity/index'
import Missions from './missions/index'
import Settings from './Settings'

export default {
  data() {
    return {
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
  },
}
</script>

<style scoped>
.profile-pic {
  width: 100%;
  background-color: #fff;
  border-bottom: 1px solid #ddd;
  color: rgba(0, 0, 0, 0.56);
  padding: 5px;
}

.page--material .profile-pic {
  background-color: #f6f6f6;
}

.profile-pic > img {
  max-width: 100%;
}

.profile-pic > .app-name {
  vertical-align: bottom;
  line-height: 57px; /* FIXME should be dynamic from img */
  display: inline-block;
  margin-left: 1em;
}
</style>
