import Vue from 'vue'

import CarouselDots from '@/partials/CarouselDots'
import CollectDate from '@/partials/CollectDate'
import CollectGeolocation from '@/partials/CollectGeolocation'
import CustomToolbar from '@/partials/CustomToolbar'
import DecryptPayload from '@/partials/admin/DecryptPayload'
import ExtractThumbnailFromExif from '@/partials/admin/ExtractThumbnailFromExif'
import ForceRpo from '@/partials/admin/ForceRpo'
import GenerateCryptoKeys from '@/partials/admin/GenerateCryptoKeys'
import GoogleMap from '@/components/googleMap'
import Help from '@/partials/Help'
import JoinLeaveProject from '@/partials/admin/JoinLeaveProject'
import MenuWrapper from '@/partials/MenuWrapper'
import NoRecordsMsg from '@/partials/NoRecordsMsg'
import ObsListItem from '@/pages/obs/ObsListItem'
import PhotoPreviewModal from '@/partials/PhotoPreviewModal'
import RelativeTabbar from '@/partials/RelativeTabbar'
import RequiredChip from '@/partials/RequiredChip'
import TestEncryptPayload from '@/partials/admin/TestEncryptPayload'
import WowAutocomplete from '@/partials/WowAutocomplete'
import WowHeader from '@/partials/WowHeader'
import WowInputStatus from '@/partials/WowInputStatus'

Vue.component('carousel-dots', CarouselDots)
Vue.component('custom-toolbar', CustomToolbar)
Vue.component('google-map', GoogleMap)
Vue.component('join-leave-project', JoinLeaveProject)
Vue.component('menu-wrapper', MenuWrapper)
Vue.component('no-records-msg', NoRecordsMsg)
Vue.component('relative-tabbar', RelativeTabbar)
Vue.component('wow-autocomplete', WowAutocomplete)
Vue.component('wow-collect-date', CollectDate)
Vue.component('wow-collect-geolocation', CollectGeolocation)
Vue.component('wow-decrypt-payload', DecryptPayload)
Vue.component('wow-extract-thumbnail-from-exif', ExtractThumbnailFromExif)
Vue.component('wow-force-rpo', ForceRpo)
Vue.component('wow-generate-crypto-keys', GenerateCryptoKeys)
Vue.component('wow-header', WowHeader)
Vue.component('wow-help', Help)
Vue.component('wow-input-status', WowInputStatus)
Vue.component('wow-obs-list-item', ObsListItem)
Vue.component('wow-photo-preview', PhotoPreviewModal)
Vue.component('wow-required-chip', RequiredChip)
Vue.component('wow-test-encrypt-payload', TestEncryptPayload)
