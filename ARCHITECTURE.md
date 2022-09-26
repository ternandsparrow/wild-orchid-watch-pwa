This document will describe how the app is built and why choices were made.
Read it! ಠ_ಠ

# Minimum version of browsers that we support
In an ideal world, we'd support as many browsers as possible but there are
diminishing returns in doing that. When we started out we were basically aiming
at the browsers that introduced service worker support. Part way through
development that shifted as we pulled in some dependencies that were only
available in ES6. Here's a fun fact, webpack/babel doesn't transpile your
dependencies, just in case (like me) you though it did. You can ask it to (see
`transpileDependencies` for the `vue-cli`) but it's horribly slow. You'd be
better off forking the dependencies and making them transpile to ES5 and
publishing that.

So, our hand has been forced and now we support the following browsers:
- Google Chrome 60+ (July 2017)
- Mozilla Firefox 55+ (August 2017)
- Apple iOS Safari 11.3+ (March 2018)
- Samsung Internet 8.2+ (December 2018)
- Apple macOS Safari 11.1+ (March 2018)


# Continuous integration/deployment
We use CircleCI for CI/CD. The way we've [configured](./.circleci/config.yml)
the workflow is that *all* branches will be linted and unit tested for every
commit. When it comes to deploying the app to a publicly accessible location,
only 3 branches are deployed. At the time of writing, these are where each
branch is deployed:
 - develop is deployed to dev.app.wildorchidwatch.org
 - beta is deployed to beta.app.wildorchidwatch.org
 - master is deployed to app.wildorchidwatch.org

This is all configurable via the environment variables used during the build
process if you wish to change it.


# High level steps to set this project up from scratch
These steps shouldn't be needed as the project was handed over already
configured. They may be needed for setting up a development environment or if
this project is forked for another iNat project.

This is how to get the project running as-is. We'll address changes for a fork
after.

  1. find somewhere to host this app/site (Firebase hosting, AWS S3 website, etc)
  1. create a DNS record to point to the hosting. We'll use `wow.example.com` as
     an example
  1. ensure that the web hosting is done over HTTPS (PWAs must be served over
     HTTPS)
  1. create a [traditional](https://www.inaturalist.org/pages/managing-projects#traditional) project on iNaturalist, which is where observations will be stored
  1. create all the required observation fields in iNaturalist (see
     `scripts/create-obs-fields.js`)
  1. add all the obs fields to the new iNat project
  1. create an [OAuth client app](https://www.inaturalist.org/oauth/applications) in iNat, making sure to *not* choose "confidential" as a static website cannot keep secrets
  1. edit `.env.local` to override all the required values from `.env` so point
     to all the obs field IDs (you created above) and other configurable items
  1. run the dev server locally with `yarn serve` and confirm everything works
  1. configure CircleCI to build this repo and supply all the expected env vars
     (see `.circleci/config.yml`)
  1. trigger a build in CircleCI so the project is deployed to your hosting
  1. visit wow.example.com to use the app

If you're forking this project, a lot should be usable as is. You'll still be
submitting observations to a single project on iNat so all the pipeline for
uploading observations will be usable.

The things you will need to change are any branding (there is very little) and
the hardcoded knowledge about observation fields. The main reason we have so
many obs field IDs configured is for linking to the help doco. The other reason
is complex logic around when to display or make certain obs fields required.
You'll have to change this to suit your particular set of obs fields.

Doco gets out of date so the best way is to read the code. Look for what happens
when you opt to create an new observation and follow the trail from there. Most
of the changes will be required at the start but once the observation has been
written to the datastore, fewer changes will be required to get it uploaded and
it's treated fairly generically.


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
There are a number of options in this space: Vue, Angular and React to name a
few. This biggest reason we chose Vue.js is the team already has skills in the
technology so we can hit the ground running. We do believe Vue is the right
technology for the project as it's easy to work with (no need to fuss with
Typescript or JSX), has a strong community and does everything we need.


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
Vuex enforces some rigor into how you deal with application state. It helps by:
  - centralising state management
  - makes it easy to share data between components
  - makes it easy to persist the state to localStorage so the app "remembers where is was" on subsequent visits
  - makes for easier testing

Where possible we've tried to export facades in the root store module to stop
dependency hell between the child namespaced modules. For example, assume we
have an action in the 'auth' namespaced module and it needs to be accessed by
another namespaced module: the 'obs' module. We could just have the 'obs'
module call the action directly on the 'auth' namespace but this tightly
couples the 'obs' to the 'auth' module. After you've done this a bunch of
times, maintenance can get harder so we avoid this by exporting a facade action
in the root store that just calls into the 'auth' module. The rule is a module
cannot call actions on its sibling, only on it's parent.


## localForage
A simple key-val store that we use to store observations that haven't yet been
uploaded. We did use Dexie first off but it turns out we don't need all the
extra DB-like functionality and localForage helps with compatibility as it will
run on various underlying storage APIs and handles (de)serialising Blobs when
running on webkit. On this last point, related to blobs on webkit, it seems to
work on macOS but Safari 10.3.4 on iOS kills it so it's not flawless.

We configure the available drivers to exclude localStorage because we can't
store binary data out-of-the-box. It's possible if we wrote our own
(de)serialisation but that seems a bit far to go.


## iNaturalist
We need somewhere to store the observations that our users create. We could
create our own walled garden but then we'd have to reinvent a lot of wheels and
at the same time, we'd split the community. Neither are good for anyone. We
assessed a number of platforms to contribute to and iNat was easily the best
due to:
  - large, long running community
  - open source code base
  - well developed platform that supports a lot of our requirements (threatened species, identifications, etc)
  - already providing both a website and an API
  - responsive dev team
  - support for us to host our own project on their platform (called 'projects' in their terminology)

A note about **created_at, updated_at timestamps**: iNat doesn't use the values
that we supply for these fields so we don't bother storing them locally. Brief
tests also showed that the `updated_at` field doesn't change when we PUT the
observation record. So when a user edits a record, we can't even show them a
meaningful "last updated at" date. We only have the observation date to use.


## JestJS
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
We *need* some sort of error tracker and the choice came down to Rollbar,
Airbrake and Sentry. All three are good choices but we went with Sentry as it
has the cheapest paid tier if we decide to go paid. You can also self-host
Sentry if that seems like a more cost-effective solution but I'm not convinced
it will be. [Their
doco](https://github.com/getsentry/onpremise#minimum-hardware-requirements)
says you *need at least* 2400mb of RAM. To run a VM with that much RAM is going
to cost almost as much as just paying for their SaaS hosted solution, plus you
don't have to maintain it yourself.

Google Cloud Platform offers "Stackdriver error reporting", which sort of does
the same thing. It is mainly geared towards server side reporting, and although
they offer a NodeJS client, this cannot be used for client side code (I tried).
You can use the HTTP API though (and we do for the "bug reporting"). Compared
with Sentry (and similar), the error reporting is much simpler, you get to
report:
  - a message
  - a location in source
  - a user
  - http context
The dashboard updates quickly and you can get email notifications. There seems
to be some issue merging logic and you can link to your issue tracker. If a
simple solution will suffice, this is worth looking at. But out-of-the-box,
Sentry gives you a lot more context. You could probably add this context in
Stackdriver, but you'd have to build and maintain it yourself.

Firebase, which we use for hosting, offers Crashlytics but it's only for native
apps. So that's a non-starter for us.

[TrackJS](https://trackjs.com/) also looks promising. I haven't tried it but
from their demo video, it looks like it potentially offers a bit more than
Sentry. I found them after using their RemoteJS (just integrated into the WOW
app) tool. They offer discounts/support for not-for-profit, which this project
would hopefully qualify for.


## Google Cloud Stackdriver Error Reporting
We have this in the mix too because the "Report Problem" (BugReport) feature
needs to send quite a bit of data (10kb payload isn't unexpected) and this is
too much for the other alternatives we had on hand:
  - Sentry won't error when you send that much data but it does truncate the payload
  - sending via email with a mailto: href gives a 413 error for gMail (might
     work for native clients, but it's pushing it)

The requirements when looking for something that would accept our user
triggered bug reports were to stick within the requirements of the existing
app, so:
  - cost effective
  - minimal operational overhead (no server to run)

Additionally it'd nice if we don't need to use yet another service so as we
already need Google Cloud, options on that platform are attractive. Stackdriver
is good because it already has a UI for displaying reports, it can handle the
payload size, it's free and it can trigger email alerts.

We looked at Stackdriver logging but the UI doesn't fit our use case and there
doesn't seem to be email alerts for new items (only for configuration issues),
which are pretty useful. In any case, all Error Reporting errors are accessible
from the Logging UI anyway so you can choose which interface to use.

One sticking point is that all the clients are designed to run in server-side
environments. The NodeJS offering
(https://github.com/googleapis/nodejs-error-reporting) can't run in a
client-side browser world because it has expectations on things in the
`process` global that Node sets up. There is a HTTP API though, the call isn't
hard and it's probably safe to assume that Google can version and honour their
API correctly so there's minimal risk. We rolled our own client to that API
incase the community adopts it and we can share any maintenance load:
https://github.com/ternandsparrow/stackdriver-error-reporting-clientside-js-client.


## Workbox
This eases the work related with managing a service worker. We still have to do
some of the heavy lifting because our background sync requirements are a bit
more complicated than the simple case. Workbox can replay single requests
out-of-the-box but we need to wait for the photo requests to succeed (or not),
then use the photo IDs in the request to create the observation.  Workbox gives
us the freedom to do this and we can even use their Queue class to make our
life easier.

If you're looking to manually trigger sync events on the background sync
queue, you'll have access to this in the hidden admin page. Alternatively, you
can use Chrome devtools to send named events to the SW as per
https://developers.google.com/web/tools/workbox/modules/workbox-background-sync#testing_workbox_background_sync.
The name of the event you need for our queue is:
```
workbox-background-sync:wow-queue
```

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

## Fuse.js
We use this as the fuzzy-find index for species autocomplete. I looked at other
options like [FlexSearch](https://github.com/nextapps-de/flexsearch) and
[Elasticlunr](http://elasticlunr.com/). As the [benchmarks
show](https://raw.githack.com/nextapps-de/flexsearch/master/test/benchmark.html)
both options would have been faster but they were also more complicated and
we're not searching that many items. Fuse allowed us to just feed the array of
items in with config specifying the fields to search and we're off. No itering
through to add documents to an index.

## DayJS
We picked this over moment.js because it's API compatible but smaller. We don't
need the locales from moment and that is what makes it a bloated package.


# Design decisions

## Strategy for databases in IndexedDB
Currently we run three databases:
  1. one for storing observations, the `obsStore`
  1. one for the photos, the `photoStore`
  1. one for other data, the `metaStore`

<!-- FIXME this is outdated, update it -->

The `obsStore` is really the main store you should worry about. It stores the
observations locally until we've uploaded them to iNat. The main (UI) thread
does most of the manipulation of these records. Be aware that the SW will also
touch the records by setting the recordProcessingOutcome. It would have been
good to only have one thread writing to the DB but the SW can continue to run
in the background after the clients are closed, suspended, etc (think someone
turning their phone screen off). This means we need the SW to be able to write
as it's the only one around to do it.

The `swStore` is used as a persistent working area for the SW while in
processes an observation. The SW first tries to create the observation on iNat,
and while that's happening it stores the data for the dependent requests
(photos and obs fields) in its DB. Once the request for the observation itself
has succeeded, the requests for the dependents are generated and the record is
removed from the DB. This is why this DB will be empty most of the time.

There is also one other DB that you'll see, but it's not directly owned by our
code. It's the DB that's managed by Workbox's queue. (At the time of writing)
Each of the records in this DB will be a single request that Workbox is waiting
to make.

Beware the limitation of IndexedDB if you have WOW open in multiple tabs.
Apparently connections from one tab will block connections from the others. The
other connections won't fail, they'll just block until they can run. At the
time of writing, I wasn't able to reproduce this behaviour but if you see weird
things happening, this is something to investigate.


## Getting photos from the user
We did actually have a choice here. We went with option 1.

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
  - LG Android camera (built-in to LG phones). On device it's known as
      `com.lge.camera`, which is installed to
      `/system/priv-app/LGCameraApp/LGCameraApp.apk`
  - [CameraMX](https://play.google.com/store/apps/details?id=com.magix.camera_mx&hl=en_AU)
      (remember to enable geotagging so photo have GPS location stored)


## Taxonomy index
The iNat API provides an endpoint to do a species autocomplete. It works but
it's not without issues for us as we only want to query part of the taxa tree
(orchids) and the server doesn't support that. There's also the fact that we
want to support offline searching so needing an internet connection kills the
option of using the iNat API.

The API also offers the ability to get the taxonomy list. Thankfully you can
set the starting point and drill down from there. Unfortunately there's a limit
of 10k results for a query set and we hit that when we try to get everything
under Orchidacae. To workaround this, we start with the "everything under
Orchidacae" query and get as much as we can. Then we look in our result set for
descendants of Orchidacae that also have a lot of children ("a lot" is
configurable). For each of these descendants, we run another query and discard
anything we've already seen. We could keep going like this but after two
iterations, it's likely that we already have everything.  This API is a bit
naughty too in that it returns duplicates so we have to clean them out too.

The problem with the taxonomy list that we've gotten so far is that it's
*everything*. We have no (good) way to filter this down to only Australian
orchids, which ultimately are the only ones it makes sense to suggest to our
users. To solve this, we pull a species list that can be confined by a place:
Australia, and a taxon: the same one we used for the taxonomy list. Now we use
all the records from the species list and add any rank=genus records from the
taxa list that we don't already have and that's our result.

You might have noticed that building the list of suggestions from observations
has the drawback that we only suggest things that have already been seen. That
means if a user is the first to spot a species (on iNat) then we won't provide
that as a suggestion. It's not a huge deal because they are only suggestions
and the user can input whatever they like.

We use the `scripts/build-taxa-index.js` script to pull data from the API and
transform it into the format that we need in our app. This output is stored in
the `public/` directory which means it get automatically included in the PWA
manifest so it will be precached. We include it in source control too because
it easier than always regenerating it.

We use Fuse.js to search the index with fuzzy-find style behaviour. The result
is we have a taxa list that's available offline, only includes orchids and
saves clients from having to do needless processing as we can do it once at
build time.

When it comes time to roll out a new version, we get the cache busting for free
from workbox because it's part of the manifest.

Currently it's a manual job to periodically re-run the script to build a new
list and if it's changed, commit it to git. This could be automated by
periodically running a cron job somewhere and if a diff shows there's new data,
then poking a human by email, sending a pull request to the git repo, etc.

We chose to bake the list into the app for a number of reasons:
  1. we don't need to run anything extra in the way of hosting
  1. it allows offline support
  1. the processing only needs to be done once and all users can use it. In
     theory it could be run on-device but that's wasteful as all users would
     need their device to repeat work that's been done elsewhere
  1. a developer is around when it's running so it can have an eye kept on it
  1. everything comes from iNat, which promotes people to make any required
     changes *in* iNat (or Wikipedia, etc). If we maintained our own list
     somehow, it would fragment to community and mean more effort for us to
     maintain and parse the list


## Error tracking strategy
In Sentry at least, "breadcrumbs" are automatically recorded. These are
basically the events (in a loose sense of the term, not a DOM sense) that
happened leading up to the Sentry report. Things like route changes, UI
interaction and console messages.

When a `ui.click` breadcrumb is recorded, it's nice to know what the user
actually clicked on. CSS selectors aren't the most helpful so instead we can
make our lives a bit easier by adding a `name` attribute to each button (or
other element) that we have so we'll more easily be able to tell what the user
clicked on. These names are purely for this use, so don't get confused when you
can't find any usages of it in our code.


## Gathering geolocation
Creating observations that have GPS coordinates is essential for them to be
useful at the other end when scientists use them. For this reason we make
geolocation mandatory and offer four ways to collect that data:
  1. extracted from the EXIF of attached photos (also mandatory)
  1. using the location of the device
  1. dropping a pin on a map
  1. (in detailed mode) manually entered
This is also in the order that we prefer as more automated options are more
reliable. We've seen some devices that don't work as well as we'd hope. A
Samsung A8 that we tested on often wouldn't geo-tag photos taken with the
Samsung camera but would immediately give an accurate device location to the
browser. Using a different camera app, like MX Camera, would fix the problem
but we can't expect users to install a seperate camera app.


## Storing answers to our questions in iNat
iNat has the core observation record, which contains species name, datetime,
coordinate, observer and other information. There is no possibility to store
any extra data *in* the observation record. iNat does provide for this "extra
data" use case through a feature they call "observation fields". Any user can
view/define these here: https://www.inaturalist.org/observation_fields.

Fields can define their type and an enum/controlled vocabulary of valid values,
which are enforced. We use these observation fields to store the answers for
almost all of the questions we ask. At the time of writing, the only questions
that don't get stored as observation fields are species name, coordinates and
notes.

To ease the process of creating these fields, and to store their configuration
in source code, we have the `./scripts/create-obs-fields.js` NodeJS script.
When run, this script will create all the fields in the target iNat instance.
This is something that only needs to be done once for production but it may be
required more often during development. The script requires some configuration
to run so it's best to read the source code before running it.

One limitation of observation fields is that they're owned by a single iNat
user, with no option for transfer. Ideally they would be owned by the project
and any curator of the project could maintain them but that's not currently the
case. As a workaround, we've created an iNat user purely to own the fields.

It's not a good idea to make changes to the observation fields once they
already have observations that use them. iNaturalist tells you this on the edit
page for a given obs field too. The only changes you can safely make are to add
a new obs field or add a new value to an existing obs field. Any other change
is going to disrupt things in a bad way.


## Multiselect observation fields
Another limitation of observation fields is that they can only have a single
response and you can only have one instance of each field on an observation. So
for a use case where you ask a question like "select all life stages present in
the population", you need to get a bit creative to support that in iNat. Your
options are:

  1. serialise multiple values into a single response, such as
     lifeStages="stage1|stage2"
  1. have repeated questions to capture each response, such as
     lifeStage1="stage1", lifeStage2="stage2"
  1. pivot the question so each possible response becomes it's own boolean
     question, such as "is stage1 present?"=yes, "is stage2 present?"=yes

The first two options aren't great for a few reasons but mostly because they
make the data hard to consume. The only drawback for the third option is we
have to create more observation fields in iNat but we think that's acceptable
for ending up with usable data.

We use option 3 and we call these types of question "multiselects". This is
because there are an enumerated set of options and you can select 0 to many of
them. We also treat them specially in the UI, with some UI sugar, to make them
nicer to interact with.

# Project risks
## iNaturalist shuts down
Highly unlikely | Medium impact
If another system takes its place, update the WOW app to use the new system
(significant code changes required). If no other system is available, fork the
open-source iNat code and start a WOW specific iNat instance. The app will only
need configuration changes and everything will be running again.

## iNaturalist makes breaking changes to its API
Unlikely | Medium impact
Code changes would be required to update the WOW app to work with the new iNat
API. If this happens, it's almost certainly a bug and not the desired outcome
so reporting the situation to the iNat team would be wise. Then they can fix
the problem and support the V1 API contract that we use.

## A new web browser, or new version of an existing web browser is unable to load the app
Unlikely | Low impact
No action is required if its acceptable that users of that browser cannot use
the app. You could ask that users use a supported browser if that's feasible.
If support is needed, code changes to the app would be required to add support.

## NPM dependencies that we use are removed from NPM
Highly unlikely | Medium impact
This will have no impact on the running app as it's already bundled with
everything it needs during build. For any new versions of the app that are to be
released, alternative dependencies would need to be found (or the old version
pulled from an archive).

## Our web hosting platform is shutdown
Unlikely | High impact
It's likely that the product would be seamlessly replaced with another
comparable one. But worst case scenario, this app can be served from any web
server that can serve static assets. The only special requirement is that URLs
for documents that would 404 are instead redirected to the main index page so
the SPA component can take over.
