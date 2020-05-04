import Vuex from 'vuex'
import { shallowMount, createLocalVue } from '@vue/test-utils'
import CollectGeolocation from '@/partials/CollectGeolocation'

const localVue = createLocalVue()
localVue.use(Vuex)
localVue.prototype.$wow = { uiTrace: function() {} }

describe('CollectGeolocation', () => {
  it('should toggle map visibility', () => {
    const wrapper = buildWrapper()
    wrapper.vm.toggleMap()
    expect(wrapper.vm.$data.isShowMap).toBe(true)
  })
})

function buildWrapper() {
  const store = new Vuex.Store({
    actions: {
      flagGlobalError() {},
    },
    modules: {
      app: {
        namespaced: true,
        state: {
          isAdvancedMode: false,
        },
      },
      ephemeral: {
        namespaced: true,
        getters: {
          oldestPhotoCoords: () => null,
          coordsForCurrentlyEditingObs: () => null,
        },
        mutations: {
          resetCoordsState: () => {},
        },
      },
    },
  })
  return shallowMount(CollectGeolocation, {
    props: { photoCount: 3, isExtraEmphasis: false },
    localVue,
    store,
    stubs: {
      'google-map': true,
      'v-ons-button': true,
      'v-ons-icon': true,
      'v-ons-input': true,
      'v-ons-list': true,
      'v-ons-list-item': true,
      'v-ons-radio': true,
      'wow-header': true,
      'wow-input-status': true,
      'wow-required-chip': true,
    },
  })
}
