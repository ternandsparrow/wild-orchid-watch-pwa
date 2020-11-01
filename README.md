A [PWA](https://developers.google.com/web/progressive-web-apps/) using
[Vue.js](https://vuejs.org/) and [Onsen UI](https://onsen.io/). Used for
citizen science data collection for orchids in Australia. Uses OAuth from, and
uploads obsversations to [iNaturalist](https://inaturalist.org/).

Thinking of forking this for your own iNat project? That's a great idea! The
code is tailored for our specific use case but we hope it provides most of the
solution and you just need to adapt it for your questions (obs fields) and
branding. High level steps on how to tackle this [are
here](./ARCHITECTURE.md#high-level-steps-to-set-this-project-up-from-scratch).

# Users
This app (actually it's a website that behaves like an app) is deployed to
https://app.wildorchidwatch.org and you can use it directly from there. There is
no need to deal with the source code unless you're a developer working on
changes to WOW.

Observations submitted via this app will be *directly* uploaded to the [WOW
iNaturalist project](https://www.inaturalist.org/projects/wild-orchid-watch-australia). This app is a client for iNaturalist with a focus on:
  - ease of use for citizen scientists
  - only dealing with orchids
  - making it as easy as possible to submit detailed observations to the iNat
      project

This app is not the only way to submit observations to the iNat project, but it
is the best because it's tailored for this specific use case.

# Developers

## Quickstart

Requirements:
  - yarn >= 1.16
  - node >= 12 (or at least an LTS release otherwise you'll have to compile some
      things as part of the dependency install - like sharp - and that will either
      take a long time or fail... Just use an LTS release!)
  - modern web browser (Chrome or Firefox are good choices)

As a developer on this project, follow these steps to get the webpack dev server
up and running. This is a local web server that builds the project and serves it
on localhost so you can test your changes to the code. It includes a "hot
reload" feature so you leave the server running while you make code changes and
as files change, the dev server automatically rebuilds the deltas for a really
quick feedback loop.

The WOW app is just a way to interact with a single "traditional" project on an
iNaturalist instance. The app *requires* an iNaturalist instance to operate. For
production, this would be the "real" iNat (inaturalist.org) but during
development it's likely to be a seperate instance.

You'll need an active internet connection to use this app as it will communicate
with an iNat instance. If you want to work completely offline, that's possible
to do by running an iNat instance locally. See
https://github.com/ternandsparrow/inaturalist-docker for an easy way to spin up
an iNat stack.

### Once-off set up steps

  1. clone repo
  1. install deps
      ```bash
      yarn
      ```
  1. copy the example env local override file (**DO NOT** copy the .env file)
      ```bash
      cp example.env.local .env.local
      ```
  1. (optional) edit the env local override file to change anything you like.
     You don't need to make any changes to get up and running though.
      ```bash
      vim .env.local
      ```

### Steps you'll run every time

  1. run the dev server:
      ```
      yarn serve
      # Or, if you want a different port
      yarn serve --port=8081
      # Or, if you want to listen on your external IP
      yarn serve --host=11.22.33.44
      # note that accessing the app from an address other than localhost AND
      # without HTTPS will only work when running in development mode as
      # there's no service worker. PWAs require HTTPS and a valid cert,
      # which you almost certainly don't have on your local machine. See below
      # for steps to correctly set up for remote devices to connect.
      ```
  1. open the app URL (probably `http://localhost:8080`) in your browser
  1. this is a PWA and we've chosen a UI framework that copies the look and feel
     and native Android and iOS. So it's best to enable the [Mobile Device Viewport Mode](https://developers.google.com/web/tools/chrome-devtools/device-mode/#device)
     as a Pixel 2 or iPhone 8.

### Easier debugging
There is another command you can to start the dev server: `yarn serve:debug`.
This command configures the JS transpiling to target a more recent platform so
the generated code will more closely match the code that you write. Trust me,
this makes debugging async code much easier. It's probably a good idea to use
this version of serve all the time for local development. Have a look at the
`scripts` key in `package.json` to see how we achieve this.

## "Not so quick" quickstart to support remote devices accessing your local dev server

PWAs *need* to be served over HTTPS for essential features to work. There's an
allowance for localhost to *not* require HTTPS, which is why the quickstart
method above works.  If you want to run the dev server and access it with your
phone, or emulator, then you'll need something in place that provides HTTPS.
Using snakeoil certs doesn't seem to work well (at the very least, Hot Module
Reload sockets won't connect) so the fix is to run a remote SSH tunnel to a
bastion host that has a real SSL cert issued. You can use [this docker-compose
stack](https://github.com/tomsaleeba/docker-https-ssh-tunnel) to achieve that.

  1. start the bastion host from [this
     repo](https://github.com/tomsaleeba/docker-https-ssh-tunnel)
  1. run the webpack-dev-server for this project, telling it to respond to the
     DNS associated with the bastion host
      ```bash
      PROXY_HOST=blah.example.com yarn serve
      ```
  1. start the remote SSH tunnel to the bastion host (confirm command in the other repo)
      ```bash
      ./start_tunnel.sh 8080 blah.example.com
      ```
  1. generate a new oauth app on the target inat server, e.g. at
     https://dev.inat.techotom.com/oauth/applications and fill in the
     appropriate redirect URL
  1. update your .env.local

Now you have a publicly accessible host, with an SSL cert from a trusted CA,
that also has HotModuleReload. Hack away!

## House keeping tasks
This project was planned to make it as easy as possible to operate and maintain.
It's essentially a static website so it's cheap and easy to host, very robust
(assuming it's served from a stable CDN) and requires minimal upkeep as there
are no servers to maintain.

There are still a few tasks that need to be done from time to time:

  1. update orchid taxa list
  1. check for security issues with our dependencies

### Updating the orchid taxa list
Run the `scripts/build-taxa-index.js` script to produce the latest taxa list
used for the orchid species autocomplete. Then commit the the result of the
script. The CI/CD build pipeline will then do a deploy and users will recieve
the new list when they update.

If you've already run the script, you might want to force a refresh of the taxa
data from iNat otherwise it'll just rebuild the list from your local cache. To
do this:
```bash
./scripts/build-taxa-index.js --force-cache-refresh
# run with --help for full list of options
```

This script reads species from observations made in iNat so as more observations
are made, the list will change.  Nothing will break if you don't do it, but by
doing it regularly, users will have a better experience because they'll have a
more complete list of suggestions.

See more about why it was built this way in [the ARCHITECTURE.md doc](./ARCHITECTURE.md#taxonomy-index).


### Checking for security issues with our dependencies
We have a very small attack surface because we don't operate any servers; the
WOW app is just a static website. At the time of writing, the code is hosted on
GitHub and as part of that, you get free security notifications from dependabot.

When assessing these notifications, it's important to keep a few things in mind:
  1. a lot of our dependencies are "devDependencies" only used at build time.
     Security issues with these can probably be ignored as they don't affect our
     users.
  1. dependabot will send pull requests to update transitive dependencies. That
     is, dependencies of our dependencies. You should be wary about accepting
     these pull requests because you're essentially forcing our direct
     dependencies to run with a different version of their dependencies than
     what the developer intended. The most reliable approach is to only update
     our direct dependencies and let the developers of our dependencies manage
     their dependencies.

To update the project's direct dependencies, you can use [`yarn
update`](https://classic.yarnpkg.com/en/docs/cli/upgrade/). Note that this will
update to the newest version allowed by `package.json`, which may not be the
newest version released.

## Running with/testing the service worker

To check that the service worker is working as you expect, there's a few things
you need to do differently. We can't use the webpack dev server, instead we need
to perform the full build process and serve the built files. We can do that with
the following command:

```bash
yarn build:serve
```

To make your life easier when it comes to debugging, we make two changes to the
build: don't minify the output and don't transpile. This means you can debug the
source directly, not the sourcemap, and when you place a breakpoint in an async
function, it'll go where you expect. To achieve this, we set two env vars when
we build `BROWSERSLIST_ENV=debug` ([more
info](https://github.com/browserslist/browserslist#environment-variables)) and
`DISABLE_MINIFY=1`. This is done behind the scenes for you but you can use these
against the normal `yarn:build` too.

We also allow Vue devtools to connect to a site built and served using this
method. This is done by setting `VUE_APP_FORCE_VUE_DEVTOOLS=1`. Search this
codebase to find how we use that env var.

## Configuring env vars
There are aspects of this app that can be configured at deploy-time such as API
URIs, keys, etc. We achieve this by using `.env*` files that `vue-cli` reads
and injects for us. [See the
doco](https://cli.vuejs.org/guide/mode-and-env.html#environment-variables) for
more details.

There are a number of defaults configured already in `.env`. If the values in
this file don't suit your environment, you can an override them in a file named
`.env.local` . Git *will ignore* this `.en.local` file.

CircleCI builds will have any required vars written to the `.env.local` file
during the build process so check the [build config](./.circleci/config.yml) if
you need to make sure a value is configured during the build.

## Config deployed app via environment variables

Look in `src/misc/constants.js` for all the values that can be configured. See
the [CircleCI config](.circleci/config.yml) in the build step, for how we set
them during CI. The summary is there are a few items that aren't environment
specific (Firebase token, Sentry DSN, etc) and the rest that are prefixed with
an environment name like `PROD_`, `BETA_` or `DEV_`.

### Sentry
We need two sets of configurations items for Sentry for the two spots that we
use it. The first is the DSN that we use to report issues from the running app.
The second are the details that the `sentry-webpack-plugin` uses to mark a
release during CI/CD and upload the sourcemaps.

These are the env vars that need configuring in CircleCI:
  1. `SENTRY_AUTH_TOKEN` an API key, different from the DSN. You'll need to [generate
     one](https://sentry.io/settings/account/api/auth-tokens/). The default
     permissions work fine.
  1. `SENTRY_ORG` Sentry has the concept of an *organisation*, which
     can contain many projects. If we assume our organisation is called
     `my-org` then that's the value we use: `SENTRY_ORG=my-org`. Pull the value
     from the URL when you're using the Sentry dashboard if you aren't sure.
  1. `SENTRY_PROJECT` If we assume the project for this app is `wow-pwa` then
     the value to use is `SENTRY_PROJECT=wow-pwa`. Again, pull it from the URL
     when using the Sentry dashboard.
  1. `SENTRY_DSN` You get this value when you create a new Sentry project. The
     value looks like
     `https://o1111111111111111111111111111111@o222222.ingest.sentry.io/3333333`.

You'll also want to change some of the default project settings:
  1. under Project settings -> Security & Privacy -> Data Scrubbing, you should
     turn *off* `Data Scrubber` and `Use Default Scrubbers`. We've found they
     scrub information that you need to diagnose issues.
  1. adding the [GitHub
     integration](https://docs.sentry.io/product/integrations/github/) is
     probably a good idea too, so you have extra details about which commits
     introduce errors.

### Firebase
For Firebase, you don't need to deploy from your local machine. We have
CircleCI to deploy for us. To achieve this, it needs a token for auth. Get a
token with:
  1. make sure you have the `firebase` command: `yarn global add firebase-tools`
  1. on your local machine, run `firebase login:ci`
  1. confirm the login in your browser
  1. you'll get the token in your terminal, set the CircleCI env var
     `FIREBASE_TOKEN` to this value

## Testing workflow

You can run unit tests one off with: `yarn test:unit`.

If you want the unit tests to run every time you save a file (watch mode), use:
`yarn test:unit --watchAll`.

Unit tests use Jest. You can find the doco for `expect()` at
[https://jestjs.io/docs/en/expect]().


If you want to debug your tests, use `yarn test:unit:debug` and then connect
your debugger. The key is [passing the `--runInBand`
param](https://jestjs.io/docs/en/troubleshooting#tests-are-failing-and-you-dont-know-why)
to Jest.

## Architecture
See [./ARCHITECTURE.md](./ARCHITECTURE.md) for details on how this app is built
and why we chose the technologies we did.


## Useful links
  - [iNat OAuth client](https://www.inaturalist.org/oauth/applications/329).

## Why we don't eslint our web workers
Let the story begin. When we allow linting on web worker files, we get some
weird behaviour. The build is certainly capable of working because the webpack
dev server successfully builds sometimes but then other times it fails with
linting errors. The production build always seems to fail with linting errors.
The linting errors don't line up with what you see in the source file. It seems
that the output from the webpack processing/transpiling of our source is run
back through the linter and the eslint is (understandably) not happy, so it
throws errors. See my reproduction of this issue:
https://github.com/tomsaleeba/worker-plugin-eslint-test. When [this
commit](https://github.com/vuejs/vue-cli/commit/36e500d266cf0e6a7ef63fe6cca609178116e08e#diff-1a7306af1d2ca3b9b8c4809621c598d87bc00f02a175cc250f32175c20280039R27)
gets merged, we'll move up two major versions of eslint-loader (from 2.x to
4.x), which will hopefully help.
