/**
 * @jest-environment jsdom
 */
import VueRouter from 'vue-router'
import Vuex from 'vuex'
// import VueOnsen from 'vue-onsenui'
import { shallowMount, createLocalVue } from '@vue/test-utils'
import SingleSpecies from '@/pages/new-obs/SingleSpecies'

const localVue = createLocalVue()
localVue.use(VueRouter)
localVue.use(Vuex)
// localVue.use(VueOnsen) // TODO including this causes an "Invalid state" error on test start
localVue.prototype.$wow = { uiTrace() {} }
const router = new VueRouter()

describe('SingleSpecies', () => {
  let origConsoleDebug

  beforeAll(function () {
    origConsoleDebug = console.debug
    console.debug = () => {}
  })

  afterAll(function () {
    console.debug = origConsoleDebug
  })

  it('should be able to do everything required to even run a unit test', () => {
    const wrapper = buildWrapper()
    expect(wrapper.vm.$data.photos.length).toBe(0)
  })

  describe('validatePhotos', () => {
    it('should fail when no photos are supplied', () => {
      const wrapper = buildWrapper()
      wrapper.vm.validatePhotos()
      expect(wrapper.vm.$data.formErrorMsgs).toEqual([
        'You must attach at least one Whole plant photo',
        'You must attach at least one Habitat photo',
        'You must attach at least one Micro-habitat photo',
      ])
    })

    it('should pass when one of each required photo is attached', () => {
      const wrapper = buildWrapper()
      wrapper.vm.$data.photos.push({
        type: 'whole-plant',
      })
      wrapper.vm.$data.photos.push({
        type: 'habitat',
      })
      wrapper.vm.$data.photos.push({
        type: 'micro-habitat',
      })
      wrapper.vm.validatePhotos()
      expect(wrapper.vm.$data.formErrorMsgs.length).toEqual(0)
    })

    it(
      'should pass when one of each required photo is already ' +
        'present from previous edits',
      () => {
        const wrapper = buildWrapper()
        wrapper.vm.$data.existingPhotos.push({
          url: 'https://...snip.../961/square/wow-whole-plant.jpeg?1582694789',
        })
        wrapper.vm.$data.existingPhotos.push({
          url: 'https://...snip.../962/square/wow-habitat.jpeg?1582694789',
        })
        wrapper.vm.$data.existingPhotos.push({
          url: 'https://...snip.../963/square/wow-micro-habitat.jpeg?1582694789',
        })
        wrapper.vm.validatePhotos()
        expect(wrapper.vm.$data.formErrorMsgs.length).toEqual(0)
      },
    )
  })
})

function buildWrapper() {
  const store = new Vuex.Store({
    actions: {
      flagGlobalError() {},
    },
    modules: {
      obs: {
        namespaced: true,
        state: {
          recentlyUsedTaxa: [],
        },
        actions: {
          async waitForProjectInfo() {
            return {}
          },
          buildObsFieldSorter() {},
        },
        getters: {
          obsFields() {
            return []
          },
          selectedObsSummary() {
            return {}
          },
        },
      },
      ephemeral: {
        namespaced: true,
        state: {
          routerNavPromise: Promise.resolve(),
        },
        mutations: {
          enableWarnOnLeaveRoute() {},
        },
      },
      app: {
        namespaced: true,
      },
    },
  })
  return shallowMount(SingleSpecies, {
    localVue,
    router,
    store,
    stubs: {
      'custom-toolbar': true,
      'v-ons-dialog': true,
      'v-ons-alert-dialog-button': true,
      'v-ons-button': true,
      'v-ons-icon': true,
      'v-ons-input': true,
      'v-ons-list': true,
      'v-ons-list-item': true,
      'v-ons-modal': true,
      'v-ons-page': true,
      'v-ons-switch': true,
      'wow-autocomplete': true,
      'wow-collect-geolocation': true,
      'wow-collect-date': true,
      'wow-header': true,
      'wow-help': true,
      'wow-photo-preview': true,
      'wow-required-chip': true,
    },
  })
}
