#!/usr/bin/env bash
# Copyright 2026 Carnegie Mellon University. All Rights Reserved.
# Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

set -euo pipefail

plan_result="${1:-}"
e2e_result="${2:-}"

# Pass when e2e succeeded or was skipped, but only if plan succeeded
case "${plan_result}:${e2e_result}" in
  success:skipped|success:success)
    exit 0
    ;;
  *)
    exit 1
    ;;
esac
