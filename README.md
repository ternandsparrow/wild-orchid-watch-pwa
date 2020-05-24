A [PWA](https://developers.google.com/web/progressive-web-apps/) using
[Vue.js](https://vuejs.org/) and [Onsen UI](https://onsen.io/). Used for
citizen science data collection for orchids in Australia. Uses OAuth from, and
uploads obsversations to [iNaturalist](https://inaturalist.org/).

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
  1. install deps: `yarn`
  1. (optional) get a Google maps API key. You'll need the [Maps JavaScript
     API](https://developers.google.com/maps/documentation/javascript/tutorial).
     See the docs for how to generate a key. We'll configure WOW to use it
     below.
  1. ensure you have an iNaturalist OAUTH client configure as you'll need to
     login via iNaturalist to use the app. A client is already configured in the
     `.env`, which will work for local development. If you need to configure a
     different client, you can find the page create a new client on iNat here:
     https://www.inaturalist.org/oauth/applications, or the corresponding page
     on a sandbox copy of iNat. We'll configure WOW to use it below.
  1. create a `.env.local` file in the root of this project. In this file you
     can override values from the `.env` file. It's worth noting that this file
     is ignored by version control. You'll probably want define at least a
     Google Maps API key so the maps work but you may also need to change the
     OAuth client ID. It's *NOT* a good idea to just copy the `.env` because if
     the `.env` file ever changes in the future, your `.env.local` will continue to
     (incorrectly) override that. Only add the items you want to your `.env.local`
     Something like:
      ```env
      # your iNat OAUTH client app ID, if you aren't using the default one
      VUE_APP_OAUTH_APP_ID=12f220435464a8abd9878cc1805e14643432a8bd268121c7f4698ff0a903e535
      # your Google maps API key
      VUE_APP_GMAPS_API_KEY=AIzaImNotARealKeyDontTryToUseMeIxChzwoc
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

### Testing service worker

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
an environment name like `PROD_` or `DEV_`.

For Sentry.io, we need two sets of information:
  1. `SENTRY_{AUTH_TOKEN|ORG|PROJECT}` that will be used during deploy to
     upload sourcemaps and mark a release. Note that fresh projects don't have
     an auth token, you'll need to [generate
     one](https://sentry.io/settings/account/api/auth-tokens/). The default
     permissions work fine.
  1. `SENTRY_DSN` that will be deployed in the app for error reporting

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
See [./ARCHITECTURE.md](./ARCHITECTURE.md) for details on how this app is built.

## Why we don't eslint our web workers
Let the story begin. When we allow linting on web worker files, we get some
weird behaviour. The build is certainly capable of working because the webpack
dev server successfully builds sometimes but then other times it fails with
linting errors. The production build always seems to fail with linting errors.
The linting errors don't line up with what you see in the source file. It seems
that the output from the webpack processing/transpiling of our source is run
back through the linter and the eslint is (understandably) not happy, so it
throws errors. See my reproduction of this issue:
https://github.com/tomsaleeba/worker-plugin-eslint-test
