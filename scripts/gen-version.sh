#!/bin/bash
# generates a version that can be used for a deployed app
#
# we have to use the version in a few places so the trick is to generate it
# once and make sure we can ready it everywhere
set -euo pipefail
cd `dirname "$0"`

commitHash=`git log -1 --format=%h`
timestamp=`date +%Y%m%d-%H%M%S`

cat <<EOF > current-version.js
module.exports = '$commitHash.$timestamp'
EOF
