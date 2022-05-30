<template>
  <menu-wrapper title="News">
    <v-ons-pull-hook
      :action="doRefresh"
      @changestate="pullHookState = $event.state"
    >
      <span v-show="pullHookState === 'initial'"> Pull to refresh </span>
      <span v-show="pullHookState === 'preaction'"> Release </span>
      <span v-show="pullHookState === 'action'"> Loading... </span>
    </v-ons-pull-hook>
    <no-records-msg v-if="isNoRecords" fragment="There is no news" />
    <v-ons-list v-show="!isNoRecords">
      <template v-for="curr in allNews">
        <v-ons-list-item
          v-if="curr.type === 'wowIdentification'"
          :key="curr.id"
          @click="push(curr.id)"
        >
          <div class="left">
            <img class="list-item__thumbnail" :src="thumbnailPhoto(curr)" />
          </div>
          <div class="center">
            <span class="list-item__subtitle">
              <strong>{{ curr.user }} </strong>
              <span>{{ curr.action }}</span>
            </span>
            <span class="list-item__subtitle">{{ curr.timeStr }}</span>
          </div>
        </v-ons-list-item>
        <v-ons-list-item
          v-if="curr.type === 'wowNews'"
          :key="curr.id"
          @click="push(curr.id)"
        >
          <div class="center">
            <p>{{ curr.body }}</p>
            <span class="list-item__subtitle">Author: {{ curr.author }}</span>
            <!-- FIXME add        -->
            <!--   - publish time -->
            <!--   - update time  -->
          </div>
        </v-ons-list-item>
      </template>
    </v-ons-list>
  </menu-wrapper>
</template>

<script>
import { noImagePlaceholderUrl } from '@/misc/constants'

export default {
  name: 'WowNews',
  data() {
    return {
      pullHookState: 'initial',
      allNews: [],
    }
  },
  computed: {
    isNoRecords() {
      return !this.allNews || this.allNews.length === 0
    },
  },
  mounted() {
    this.doRefresh()
  },
  methods: {
    async doRefresh(done) {
      const updates = await this.$store.dispatch(
        'missionsAndNews/getProjectUpdates',
      )
      this.allNews = updates
      if (done) {
        done()
      }
    },
    push(eventId) {
      // FIXME implement this
      //   identifications go to the obs
      //   missions go to mission item
      //   regular project updates go to a full view, or nothing
      this.$ons.notification.alert('FIXME - implement this')
      console.debug(eventId)
    },
    thumbnailPhoto(record) {
      const isPhoto = record.photoUrl
      if (!isPhoto) {
        return noImagePlaceholderUrl
      }
      return record.photoUrl
    },
  },
}
</script>
