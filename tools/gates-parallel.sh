#!/usr/bin/env bash
# V7 (Team Upgrade Cycle 1): run the five release gates in one
# invocation and report one summary with per-gate logs.
#
# Measured Oct 30, 2026 (honest numbers, Cycle 1 log):
#   serial battery: 12.6 s wall. Naive all-parallel: 12.4 s —
#   NO wall-clock win (smoke is a single CPU-bound long pole),
#   AND it is UNSAFE: biome-check writes a temp file into
#   tools/ that smoke's syntax sweep can catch mid-flight
#   (".biomes-check-tmp.mjs" syntax FAIL, observed live — the
#   same shared-temp collision class the Watch hit Oct 29).
# This runner therefore uses two lanes: lane 1 = smoke THEN
# biome-check (sequential — they share the tools/ temp space);
# lane 2 = reachability, reachability-maps, mobile-check in
# parallel with lane 1. The win is one command + one verdict +
# a log per gate for triage — operator round-trips, not CPU.
set -u
cd "$(dirname "$0")/.."
LOG_DIR="${TMPDIR:-/tmp}/ono-gates-$$"
mkdir -p "$LOG_DIR"
: > "$LOG_DIR/results"
run() { node "tools/$1" > "$LOG_DIR/$1.log" 2>&1; echo "$1:$?" >> "$LOG_DIR/results"; }
lane1() { run smoke.mjs; run biome-check.mjs; }
lane1 & run reachability.mjs & run reachability-maps.mjs & run mobile-check.mjs &
wait
fail=0
for g in smoke.mjs biome-check.mjs reachability.mjs reachability-maps.mjs mobile-check.mjs; do
  rc=$(grep "^$g:" "$LOG_DIR/results" | cut -d: -f2)
  if [ "$rc" = "0" ]; then echo "PASS $g"; else echo "FAIL $g (rc=$rc) — log: $LOG_DIR/$g.log"; fail=1; fi
done
exit $fail
