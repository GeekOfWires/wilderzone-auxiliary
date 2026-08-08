#!/usr/bin/env bash
# Build all three wilderzoneClan vl2 archives into dist/.
# Thin wrapper around build-vl2.py (Python 3 required; no zip binary needed).
set -euo pipefail
cd "$(dirname "$0")"
python build-vl2.py
