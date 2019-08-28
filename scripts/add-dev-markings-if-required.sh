#!/bin/bash
# if we're running in dev, we'll change the PWA manifest and icon to make it
# obvious
set -euxo pipefail
cd `dirname "$0"`

logPrefix='[DevMarking]'
isProd="${VUE_APP_DEPLOYED_ENV_IS_PROD:?}"

pre-build() {
  [ "$isProd" = true ] && {
    echo "$logPrefix Running in prod, no pre-build work to do"
  } || {
    echo "$logPrefix Running in dev, updating pre-build PWA icons"
    cd ../src/assets/
    mv icon-seed-white.png icon-seed-white.png.disabled-for-dev
    mv icon-seed-white-dev.png icon-seed-white.png
  }
}

post-build() {
  [ "$isProd" = true ] && {
    echo "$logPrefix Running in prod, no post-build work to do"
  } || {
    echo "$logPrefix Running in dev, updating post-build PWA manifest"
    cd ../dist/
    cat <<EOJS | node > manifest.json.dev
      const mf = require('./manifest.json')
      mf.name += ' Dev'
      mf.short_name += 'Dev'
      console.log(JSON.stringify(mf, null, 2))
EOJS
    mv manifest.json manifest.json.disabled-for-dev
    mv manifest.json.dev manifest.json
  }
}

undo() {
  # for easier testing :D
  cd ../src/assets/
  [ -f icon-seed-white.png.disabled-for-dev ] && {
    echo "$logPrefix undoing icon changes"
    mv icon-seed-white.png icon-seed-white-dev.png
    mv icon-seed-white.png.disabled-for-dev icon-seed-white.png
  }
  [ -f manifest.json.disabled-for-dev ] && {
    echo "$logPrefix undoing manifest changes"
    rm manifest.json
    mv manifest.json.disabled-for-dev manifest.json
  }
}

nothing() {
  echo "usage: $0 <stage>"
  echo "      stage = pre-build|post-build"
  echo "   eg: $0 pre-build"
  exit 1
}

eval ${1:-nothing}
