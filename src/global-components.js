import Vue from 'vue'

import CarouselDots from '@/partials/CarouselDots'
import CollectGeolocation from '@/partials/CollectGeolocation'
import CustomToolbar from '@/partials/CustomToolbar'
import GoogleMap from '@/components/googleMap'
import Help from '@/partials/Help'
import MenuWrapper from '@/partials/MenuWrapper'
import NoRecordsMsg from '@/partials/NoRecordsMsg'
import PhotoPreviewModal from '@/partials/PhotoPreviewModal'
import RelativeTabbar from '@/partials/RelativeTabbar'
import RequiredChip from '@/partials/RequiredChip'
import WowAutocomplete from '@/partials/WowAutocomplete'
import WowHeader from '@/partials/WowHeader'
import WowInputStatus from '@/partials/WowInputStatus'

Vue.component('carousel-dots', CarouselDots)
Vue.component('wow-collect-geolocation', CollectGeolocation)
Vue.component('custom-toolbar', CustomToolbar)
Vue.component('google-map', GoogleMap)
Vue.component('menu-wrapper', MenuWrapper)
Vue.component('no-records-msg', NoRecordsMsg)
Vue.component('relative-tabbar', RelativeTabbar)
Vue.component('wow-autocomplete', WowAutocomplete)
Vue.component('wow-header', WowHeader)
Vue.component('wow-help', Help)
Vue.component('wow-input-status', WowInputStatus)
Vue.component('wow-photo-preview', PhotoPreviewModal)
Vue.component('wow-required-chip', RequiredChip)
