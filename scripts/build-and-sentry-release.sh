#!/bin/bash
# builds our app and performs a Sentry.io release
set -euxo pipefail
cd `dirname "$0"`
thisDir=`pwd`

# these values are used by the sentry-webpack-plugin
: ${SENTRY_AUTH_TOKEN:?} # you generate this auth token at https://sentry.io/settings/account/api/auth-tokens/
: ${SENTRY_ORG:?name of org as appears in the Sentry dashboard URL, e.g. my-org1}
: ${SENTRY_PROJECT:?name of project as appears in the Sentry dashboard URL, e.g.  my-project1}

$thisDir/gen-version.sh
export VUE_APP_VERSION=`node -e "ver = require('./current-version.js'); console.log(ver)"`

$thisDir/add-dev-markings-if-required.sh pre-build

cd ..
export DO_SENTRY_RELEASE=true
export NODE_ENV=production
# Sentry release happens in a webpack plugin
# see vue-config/config.production.js for details
yarn build:resource-constrained # FIXME because circleci doesn't have enough RAM

$thisDir/add-dev-markings-if-required.sh post-build
