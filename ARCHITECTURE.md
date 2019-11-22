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
  - central state mgmt
  - data shared between components
  - persisted to localStorage
  - root exports facades for impls in modules so we don't have cross module dependencies


## localForage
A simple key-val store that we use to store observations that haven't yet been
uploaded. We did use Dexie first off but it turns out we don't need all the
extra DB-like functionality and localForage help with compatibility as it will
run on various underlying storage APIs and handles (de)serialising Blobs when
running on webkit.


## iNaturalist
**created_at, updated_at timestamps**: iNat doesn't use the values that we
supply for these fields so we don't bother storing them locally. Brief tests
also showed that the `updated_at` field doesn't change when we PUT the
observation record. So when a user edits a record, we can't even show them a
meaningful "last updated at" date. We only have the observation date to use.

TODO, talk about:
  - strong community
  - mature platform
  - open source
  - receptive dev team
  - existing API
  - projects to namespace our observations


## Firebase
Firebase offers a lot of features, a lot of which are only for native apps, but
at this stage we're only using the hosting feature. Out-of-the-box it's
configured better than what AWS S3 is plus it has a command line that makes
deploying easy.

We run two targets (configured in the `firebase.json` file) which are identical
other than the target name. Doing this lets us associate the targets with
different custom domains. So we can run dev.app... and app... versions of the
site at the same time, from the same account and project.


## Google Analytics
To figure out how many people use the app and how they spend their time so we
can streamline any hotspots in the app.

We include GA using `vue-analytics`, which gives us some automatic tracking
using vue-router.


## Sentry
TODO
  - free tier suits us
  - lowest paid tier is most reasonable out of all competing services
  - seems to do a good job

## Workbox
This eases the work related with managing a service worker. We still have to do
some of the heavy lifting because our background sync requirements are a bit
more complicated than the simple case. Workbox can replay single requests
out-of-the-box but we need to wait for the observation req to succeed (or not),
then grab the ID for that new obs and generate all the requests for the photos,
obs fields, etc. Workbox gives us the freedom to do this and we can even use
their Queue class to make our life easier.

## Rollup
Yes, we already have webpack to do the build of our main app but 1) we need to
build our service worker, and 2) we cannot use webpack to build the service
worker. The reason we can't use webpack to build our service worker is it can't
output in a format that can be run as a service worker (IIFE or a regular
script). Rollup does allow us to do this so we've got this hybrid build chain
where we keep the webpack integrated with vue-cli, because it's easy to do so,
and we bring in Rollup to just handle the service worker.

On a side note, the reason we need to build the service worker is we want to
use external modules like localForage. Service workers don't yet support
importing modules so we solve that by building the service worker so it
contains all the dependencies it needs. Previously we used the hosted version
of Workbox (via an `importScripts()` call) but seeing as we're building the sw,
we might as well include the workbox deps in it for extra reliability.
