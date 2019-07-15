import Vue from 'vue'

// FIXME linked issue in Onboarder is fixed, we can change all
// of these to local imports in the components they're used in.

import CustomToolbar from '@/partials/CustomToolbar'
import CarouselDots from '@/partials/CarouselDots'
import RelativeTabbar from '@/partials/RelativeTabbar'
import GoogleMap from '@/components/googleMap'
import NoRecordsMsg from '@/partials/NoRecordsMsg'

Vue.component('custom-toolbar', CustomToolbar)
Vue.component('carousel-dots', CarouselDots)
Vue.component('relative-tabbar', RelativeTabbar)
Vue.component('google-map', GoogleMap)
Vue.component('no-records-msg', NoRecordsMsg)
