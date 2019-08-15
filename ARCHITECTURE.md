This document will describe how the app is built and why choices were made.

## PWA (Progressive Web App)
We chose to build this app as a PWA for a few reasons:
  1. we already have experience building web apps and this lets us reuse those
     skills
  1. PWAs, although possible back in 2014, are finally becoming mainstream with
     Twitter releasing an official PWA
  1. we can truly build one app that runs on multiple platforms
  1. HTML5 gives us access to all the hardware we need
  1. minimum friction on initial use; a user only need navigate to our site
     (via scanning a QR code) and they can start using the app. No install
     required

We explored using React Native but found the extra friction in the development
process wasn't worth it. The one thing that using React Native (or similar)
would give us that a PWA doesn't is a presence in Google Play and the Apple
AppStore. We've decided that we'll try running without that and see how we go.


## UI Framework - Onsen UI
We're using [Onsen](https://onsen.io) as it gives us a native app feel from a
purely web based client. It's also smart enough to style itself correctly based
on the platform it's running on: Android or iOS. It gives us navigation
transitions, correctly styled UI components and a number of other things
out-of-the-box.


## Vue.js
TODO


## Vue-router
Onsen does navigation via a stack of pages, managed in javascript. This means
we have one URL for all pages, which makes a few things difficult/impossible:
  1. deep linking
  1. staying on the same page while refreshing
  1. hardware back button support. Onsen *does* support this, but only when
     running in Cordova

Vue-router can run side-by-side with the Onsen navigation stack so we get the
best of both worlds.


## Vuex
TODO


## Dexie.js
[dexie](https://dexie.org) is a wrapper for IndexedDB. We use IndexedDB to
store records that haven't yet been uploaded to iNaturalist. Most of this
information is duplicated in vuex (and therefore localStore too) but the main
thing is photos. The binary data is stored in IndexedDB and we only store an
ObjectURL in vuex.


## iNaturalist
TODO, talk about:
  - strong community
  - mature platform
  - open source
  - receptive dev team
  - existing API
  - projects to namespace our observations


## Firebase
TODO
  - smart out-of-the-box object store/static website hosting with versioning


## Sentry
TODO
  - free tier suits us
  - lowest paid tier is most reasonable out of all competing services
  - seems to do a good job
