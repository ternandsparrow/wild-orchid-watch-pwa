<template>
  <menu-wrapper title="My Gallery">
    <no-records-msg v-if="isNoPhotos" fragment="You have no photos" />
    <ul v-if="!isNoPhotos" class="photo-gallery">
      <li v-for="curr of allPhotos" :key="curr._id" class="photo-item">
        <a
          :style="{ backgroundImage: 'url(' + curr.photo.url + ')' }"
          @click="handleClick(curr)"
        ></a>
      </li>
    </ul>
    <wow-photo-preview @jump="onJump" />
  </menu-wrapper>
</template>

<script>
import { mapGetters } from 'vuex'
import { wowIdOf } from '@/misc/helpers'

const galleryImgSize = 'small'

export default {
  name: 'Gallery',
  computed: {
    ...mapGetters('obs', ['localRecords', 'remoteRecords']),
    isNoPhotos() {
      return this.allPhotos.length === 0
    },
    allPhotos() {
      return [...this.localRecords, ...this.remoteRecords].reduce(
        (accum, currRecord) => {
          // FIXME we only include uploaded photos. Including local photos
          // means loading them all into memory, which can get pretty big
          // pretty fast.
          for (const currPhoto of currRecord.photos || []) {
            accum.push({
              _id: `${currRecord.uuid}_${currPhoto.id}`,
              wowId: wowIdOf(currRecord),
              photo: {
                ...currPhoto,
                url: currPhoto.url.replace('square', galleryImgSize),
              },
            })
          }
          return accum
        },
        [],
      )
    },
  },
  methods: {
    handleClick(record) {
      const url = record.photo.url
      this.$store.commit('ephemeral/previewPhoto', {
        url: url.replace(galleryImgSize, 'medium'),
        wowId: record.wowId,
      })
    },
    onJump(obsWowId) {
      this.$store.commit('ephemeral/closePhotoPreview')
      this.$router.push({ name: 'ObsDetail', params: { id: obsWowId } })
    },
  },
}
</script>

<style lang="scss" scoped>
.photo-gallery {
  padding: 0;
  margin: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;

  @mixin wow-gallery($itemCount, $photoMargin) {
    /* have to manually ignore the scrollbar :( */
    $scrollbarWidthGuess: 10vw - $itemCount;
    $totalUseableViewportWidth: 100vw - $scrollbarWidthGuess;
    $totalPhotoMargin: ($itemCount * 2 * $photoMargin);
    $photoSize: ($totalUseableViewportWidth - $totalPhotoMargin) / $itemCount;
    width: $photoSize;
    height: $photoSize;
  }

  .photo-item {
    $photoMargin: 0.2vw;
    padding: 0;
    margin: $photoMargin;
    @include wow-gallery(3, $photoMargin);

    @media only screen and (min-width: 400px) {
      @include wow-gallery(4, $photoMargin);
    }

    @media only screen and (min-width: 600px) {
      @include wow-gallery(5, $photoMargin);
    }

    @media only screen and (min-width: 800px) {
      @include wow-gallery(6, $photoMargin);
    }

    @media only screen and (min-width: 1000px) {
      @include wow-gallery(7, $photoMargin);
    }

    @media only screen and (min-width: 1200px) {
      @include wow-gallery(8, $photoMargin);
    }

    a {
      display: block;
      height: 100%;
      width: 100%;
      background-repeat: no-repeat;
      background-size: cover;
      background-position: center;
    }
  }
}
</style>
