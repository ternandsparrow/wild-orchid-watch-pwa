#!/bin/bash
# drops to a shell in a docker container that has the tools you need to run
# this project in a pinch on a VM that you haven't installed npm, yarn, etc
# onto

thePort=${PORT:-8080}

docker run \
  --rm \
  -it \
  --user=$(id -u) \
  -v $(pwd):/app \
  -p $thePort:8080 \
  cypress/base:10 \
  bash -c 'cd /app && bash'
