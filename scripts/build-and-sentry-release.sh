#!/bin/bash
# builds our app and performs a Sentry.io release
set -euo pipefail
cd `dirname "$0"`

: ${SENTRY_AUTH_TOKEN:?}
: ${SENTRY_ORG:?}
: ${SENTRY_PROJECT:?}

./gen-version.sh
export VUE_APP_VERSION=`node -e "ver = require('./current-version.js'); console.log(ver)"`

cd ..
export DO_SENTRY_RELEASE=true
# Sentry release happens in a webpack plugin
# see vue-config/config.production.js for details
yarn build
