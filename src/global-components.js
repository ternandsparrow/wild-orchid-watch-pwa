import Vue from 'vue'

// FIXME linked issue in Onboarder is fixed, we can change all
// of these to local imports in the components they're used in.

import CarouselDots from '@/partials/CarouselDots'
import CustomToolbar from '@/partials/CustomToolbar'
import GoogleMap from '@/components/googleMap'
import NoRecordsMsg from '@/partials/NoRecordsMsg'
import ObsList from '@/partials/ObsList'
import RelativeTabbar from '@/partials/RelativeTabbar'
import WowAutocomplete from '@/partials/WowAutocomplete'

Vue.component('carousel-dots', CarouselDots)
Vue.component('custom-toolbar', CustomToolbar)
Vue.component('google-map', GoogleMap)
Vue.component('no-records-msg', NoRecordsMsg)
Vue.component('obs-list', ObsList)
Vue.component('relative-tabbar', RelativeTabbar)
Vue.component('wow-autocomplete', WowAutocomplete)
