#!/bin/bash
# drops to a shell in a docker container that has the tools you need to run
# this project in a pinch on a VM that you haven't installed npm, yarn, etc
# onto. Check out the rsync-up.sh script too.
set -euo pipefail
cd `dirname "$0"`/..

thePort=${PORT:-8080}

docker run \
  --rm \
  -it \
  --name=wow-shell \
  --user=$(id -u) \
  -v $(pwd):/app \
  -p $thePort:8080 \
  cypress/base:10 \
  bash -c 'cd /app && bash'
