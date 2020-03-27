This document will describe how the app is built and why choices were made.

# Techonology choices

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
AppStore. We've decided that we'll try running without a store presence and see
how we go. We may be able to use
[TWAs](https://developers.google.com/web/updates/2019/02/using-twa) to get a
store presence (TODO - do more reading on that).


## `fetch` for HTTP calls
We need to use the `fetch` API in order to take advantage of service workers.
Using fetch means we don't support browsers that [don't support this API](
https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API#Browser_compatibility
), which is Chrome >42, Edge >14, Firefox >39, Opera >29 and Safari 10.1
(desktop)/10.3 (iOS).


## babel
Our code is written using JS syntax that not all our target browsers can
support. So we use babel to transpile/polyfill our code so it will run on all
our target. We target browsers with
[browserslist](https://github.com/browserslist/browserslist) and you can find
our config in the `browserslist` key in `package.json`.


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
extra DB-like functionality and localForage helps with compatibility as it will
run on various underlying storage APIs and handles (de)serialising Blobs when
running on webkit. On this last point, related to blobs on webkit, it seems to
work on macOS but Safari 10.3.4 on iOS kills it so it's not flawless.


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


# JestJS
The unit testing and assertion framework we're using is
[Jest](https://jestjs.io/docs/). This is what came pre-configured with the
starter project we used and it's supported by Facebook so it should have a
decent lifetime.


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

## Pseudo code for edit strategy
if 'item is queued for ID'
  we need to modify the queued item somehow
else
  queue up our item


if 'is local only'
  edit: changes need to result in a 'new' action
  delete: just delete the record (unless processing)
else
  leave record as 'new' or 'edit'


if 'is processing queued item'
  we can only act on the blocked placeholder
else
  we can act on the queued item


if 'is existing blocked action'
  edit: merge with existing
  delete: replace with delete action
else
  set value to our action

## Getting photos
We did actually had a choice here. We went with option 1.

**Choice 1: defer to system camera.** With this option we just create a `<input
type="file"...>` element and let the user agent do all the heavy lifting for us.
The benefits are:
  - we don't need to write any camera-related code
  - users can use the camera app they're familiar with
  - users have the choice to get a photo however they want: camera app, select
      an existing photo, etc
  - if the user's camera app supports it (not all do), photos taken will also be
      saved to the devices gallery/camera roll
The downsides are:
  - there's more tapping/clicking to upload multiple photos
  - we can't overlay any help text/guides on the camera
  - users will have different experiences on different devices

**Choice 2: all in-app.** With this option we would use the HTML API
[navigator.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
to get a video stream from the device's webcam. Then when the user presses the
"capture" button, we grab a frame from the video stream as the photo.
The benefits are:
  - we can control the workflow by getting the user to take one photo after
      another with fewer taps needed
  - we can overlay text and guides on the screen to help the user take photos
      like we need them
The downsides of this choice are:
  - we need to maintain all the code for the "camera"
  - any photos taken *definitely* won't be saved to the device's gallery/camera roll
  - the device *must* have a camera to use the app. This rules out devices without a camera (desktops) and those just wanting to upload a photo.
  - if we do want to support both taking a photo and uploading an existing
      photo, we need to build option 1 as well.

A note on saving photos to the gallery/camera roll on mobile devices. It seems
there's some differences with camera apps when you opt to take a photo that will
immediately be attached for an upload. Some will save the photo to the gallery
(LG's Android camera) whereras others (e.g. Samsung Android camera) will *not*
save the photo to the gallery.  The rationale behind *not* saving is that the
user is attaching a photo to be saved elsewhere so it doesn't make sense to also
save it in gallery. In our case, this is the not the behaviour we want but being
essentially just a web page means that we have zero control over this because
we're sandboxed.

Known Android camera apps that *do* save to the gallery:
  - LG Android camera (built-in to LG phones)
  - [CameraMX](https://play.google.com/store/apps/details?id=com.magix.camera_mx&hl=en_AU) (remember to enable geotagging so photo have GPS location stored)
