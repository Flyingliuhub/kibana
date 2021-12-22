#!/usr/bin/env bash

set -euo pipefail

.buildkite/scripts/bootstrap.sh

echo "--- Build Platform Plugins"
node scripts/build_kibana_platform_plugins --no-cache

echo "--- Archive built plugins"
shopt -s globstar
tar -zcf \
  target/kibana-default-plugins.tar.gz \
  x-pack/plugins/**/target \
  x-pack/test/**/target \
  examples/**/target \
  x-pack/examples/**/target \
  test/**/target
