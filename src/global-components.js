import Vue from 'vue'

import CarouselDots from '@/partials/CarouselDots'
import CollectDate from '@/partials/CollectDate'
import ConfigurationDump from '@/partials/admin/ConfigurationDump'
import CollectGeolocation from '@/partials/CollectGeolocation'
import CustomToolbar from '@/partials/CustomToolbar'
import DecryptPayload from '@/partials/admin/DecryptPayload'
import ExtractThumbnailFromExif from '@/partials/admin/ExtractThumbnailFromExif'
import ForceRpo from '@/partials/admin/ForceRpo'
import GenerateCryptoKeys from '@/partials/admin/GenerateCryptoKeys'
import FacadeMigrationTest from '@/partials/admin/FacadeMigrationTest'
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

Vue.component('CarouselDots', CarouselDots)
Vue.component('CustomToolbar', CustomToolbar)
Vue.component('ConfigurationDump', ConfigurationDump)
Vue.component('GoogleMap', GoogleMap)
Vue.component('JoinLeaveProject', JoinLeaveProject)
Vue.component('MenuWrapper', MenuWrapper)
Vue.component('NoRecordsMsg', NoRecordsMsg)
Vue.component('RelativeTabbar', RelativeTabbar)
Vue.component('WowAutocomplete', WowAutocomplete)
Vue.component('WowCollectDate', CollectDate)
Vue.component('WowCollectGeolocation', CollectGeolocation)
Vue.component('WowDecryptPayload', DecryptPayload)
Vue.component('WowExtractThumbnailFromExif', ExtractThumbnailFromExif)
Vue.component('WowForceRpo', ForceRpo)
Vue.component('WowGenerateCryptoKeys', GenerateCryptoKeys)
Vue.component('WowFacadeMigrationTest', FacadeMigrationTest)
Vue.component('WowHeader', WowHeader)
Vue.component('WowHelp', Help)
Vue.component('WowInputStatus', WowInputStatus)
Vue.component('WowObsListItem', ObsListItem)
Vue.component('WowPhotoPreview', PhotoPreviewModal)
Vue.component('WowRequiredChip', RequiredChip)
Vue.component('WowTestEncryptPayload', TestEncryptPayload)
