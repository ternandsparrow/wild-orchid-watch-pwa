#!/bin/bash
# copies your working directory to some other computer.
# Intended to be used with the docker-shell.sh script when you're tight on
# internet quota. Start a VM in the cloud, use the docker-shell.sh to quickly
# get a dev server running. Continue working on your local machine and use this
# script to rsync to the VM where the dev server will see the changes to the
# volume mounted files and rebuild. Simples.
set -euo pipefail
cd `dirname "$0"`/..

sshTargetSpec=${1:?first param must be rsync target spec, like user@some.host:/path/to/workspace}

compressParam="-zz" # rsync tells me to use this over --compress

rsync \
  --archive \
  --partial \
  --progress \
  $compressParam \
  . \
  --exclude=.git/ \
  --exclude=node_modules/ \
  --exclude=dist/ \
  --exclude=tags \
  --delete \
  $sshTargetSpec
