import Vue from 'vue'

// TODO when linked issue in Onboarder is fixed, we can change all
// of these to local imports in the components they're used in.

import CarouselDots from '@/partials/CarouselDots'
import CustomToolbar from '@/partials/CustomToolbar'
import GoogleMap from '@/components/googleMap'
import Help from '@/partials/Help'
import MenuWrapper from '@/partials/MenuWrapper'
import NoRecordsMsg from '@/partials/NoRecordsMsg'
import ObsList from '@/partials/ObsList'
import PhotoPreviewModal from '@/partials/PhotoPreviewModal'
import RelativeTabbar from '@/partials/RelativeTabbar'
import RequiredChip from '@/partials/RequiredChip'
import WowAutocomplete from '@/partials/WowAutocomplete'
import WowHeader from '@/partials/WowHeader'
import WowInputStatus from '@/partials/WowInputStatus'

Vue.component('carousel-dots', CarouselDots)
Vue.component('custom-toolbar', CustomToolbar)
Vue.component('google-map', GoogleMap)
Vue.component('menu-wrapper', MenuWrapper)
Vue.component('obs-list', ObsList)
Vue.component('no-records-msg', NoRecordsMsg)
Vue.component('relative-tabbar', RelativeTabbar)
Vue.component('wow-autocomplete', WowAutocomplete)
Vue.component('wow-header', WowHeader)
Vue.component('wow-help', Help)
Vue.component('wow-input-status', WowInputStatus)
Vue.component('wow-photo-preview', PhotoPreviewModal)
Vue.component('wow-required-chip', RequiredChip)
