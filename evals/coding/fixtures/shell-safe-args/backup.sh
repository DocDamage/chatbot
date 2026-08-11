#!/usr/bin/env bash
set -euo pipefail
backup() { cp -- "$1" "$2"; }
backup "$1" "$2"
