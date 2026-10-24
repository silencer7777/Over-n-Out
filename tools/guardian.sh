#!/usr/bin/env bash
# OVER N' OUT code guardian — runs the smoke suite and logs the result.
# Safe by design: it only *reports* failures (and lets the scheduled agent
# fix simple ones, e.g. syntax errors, with a clear commit message).
set -u
cd "$(dirname "$0")/.."
mkdir -p logs
STAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"
OUT="$(node tools/smoke.mjs 2>&1)"
CODE=$?
{
  echo "=== guardian $STAMP exit=$CODE ==="
  echo "$OUT"
} >> logs/guardian.log
echo "$OUT"
exit $CODE
