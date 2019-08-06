// All Onsen navigation stacks
//
// We don't store these in Vuex because Vuex does NOT like it when elements of
// the store are mutated outside of a commit. There are a number of things that
// do this, like vue-router mapping route props to component props. Nav stacks
// don't serialise well so really the only benefit to using Vuex is the magic
// mapping we get from mapGetters, etc.
//
// Concerns:
//   - are we exposing ourselves to race conditions by doing this?

import Observations from '@/pages/obs/index'
import {
  onboarderComponentName,
  oauthCallbackComponentName,
} from '@/misc/constants'

export const mainStack = []

export const innerPageStack = [Observations]

export function isOnboarderVisible() {
  return isTopOfStack(mainStack, onboarderComponentName)
}

export function isOauthCallbackVisible() {
  return isTopOfStack(mainStack, oauthCallbackComponentName)
}

export function mainStackReplace(newComponents) {
  stackReplace(mainStack, newComponents)
}

export function innerPageStackReplace(newComponents) {
  stackReplace(innerPageStack, newComponents)
}

function stackReplace(stack, newComponents) {
  const parsed =
    Array === newComponents.constructor ? newComponents : [newComponents]
  stack.splice(0, stack.length, ...parsed)
}

function isTopOfStack(stack, componentName) {
  return stack && stack.length && stack[stack.length - 1].name === componentName
}
