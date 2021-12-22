#!/usr/bin/env bash

set -euo pipefail

# Note, changes here might also need to be made in other scripts, e.g. uptime.sh

source .buildkite/scripts/common/util.sh

.buildkite/scripts/bootstrap.sh

cd "$KIBANA_DIR"
tar -xzf ../kibana-default-plugins.tar.gz

is_test_execution_step