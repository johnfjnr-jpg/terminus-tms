#!/bin/sh
# ITEM 5: wait for a long-running command to finish, WITHOUT the waiter
# matching itself.
#
# THE FAULT THIS EXISTS TO MAKE IMPOSSIBLE.  The obvious spelling,
#
#     while pgrep -f 'scripts/verify-all.mjs' >/dev/null; do sleep 20; done
#
# matches ITS OWN COMMAND LINE, because `pgrep -f` reads full command lines and
# the waiter's contains the pattern.  It therefore never exits.  Thirteen such
# shells accumulated in one session, the oldest 23 hours old, and they were
# real load: the same page settle measured 12,050ms with them running and
# 3,045ms without.
#
# TWO SELF-MATCHES, AND THE BRACKET TRICK ONLY CLOSES ONE.  Writing the
# pattern as `[v]erify-all` stops THIS script matching itself, because its own
# command line then holds `[v]erify-all`, which the regex does not match.  It
# does nothing about the PARENT: a shell invoked as
# `sh await-run.sh verify-all` carries the bare word, and pgrep sees it.  So
# the ancestor chain is excluded explicitly as well.  Either measure alone
# leaves a hang; this is Verification 37's shape, where a rule naming one route
# to an effect is presumed incomplete until the others are named.
#
# Usage:   scripts/await-run.sh <pattern> [poll-seconds]
#          scripts/await-run.sh --self-test
#
# Exits 0 when nothing but this waiter's own ancestry matches.

ancestry() {                       # every pid from $1 up to init
  p=$1
  while [ "$p" -gt 1 ] 2>/dev/null; do
    printf '%s\n' "$p"
    p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')
    [ -n "$p" ] || break
  done
}

matches() {                        # pids matching $1, minus our own ancestry
  pat=$1
  # The bracket trick: first character in a class matches itself but the
  # LITERAL text written here does not match the regex, so this process and
  # any child sh carrying it are invisible to their own search.
  bracketed="[$(printf '%s' "$pat" | cut -c1)]$(printf '%s' "$pat" | cut -c2-)"
  mine=$(ancestry $$)
  for pid in $(pgrep -f "$bracketed" 2>/dev/null); do
    printf '%s\n' "$mine" | grep -qx "$pid" || printf '%s\n' "$pid"
  done
}

self_test() {
  # CALIBRATED END TO END, BECAUSE THE CLAIM IS ABOUT THE WAITER'S OWN COMMAND
  # LINE.  A unit check of `matches` cannot see the fault: the fault is that
  # the waiter is itself a process carrying the pattern, so the waiter has to
  # be a real process for the test to mean anything.
  #
  # `pgrep -f` matching a merely-containing command line is measured, not
  # assumed: a process renamed to hold the token is started below and the
  # naive form is shown finding it.
  fail=0
  tok="awaitruntoken$$"
  tmp=$(mktemp -d)

  # A target that runs for a bounded time and carries the token in its name.
  ( exec -a "$tok-target" sleep 6 ) &
  target=$!

  # THE WAITER, as a real process whose own command line holds the token.
  start=$(date +%s)
  sh "$0" "$tok" 1 >"$tmp/w.out" 2>&1 &
  waiter=$!

  # NEGATIVE FIRST: a waiter that exits immediately would pass a test that
  # only checks it exits.
  sleep 2
  if kill -0 "$waiter" 2>/dev/null; then
    echo "  PASS  the waiter is STILL WAITING while its target runs"
  else
    echo "  FAIL  the waiter exited early, so its exit proves nothing"; fail=1
  fi

  # THE FAULT, reproduced against the same live population: the naive form
  # finds the waiter itself, which is why the naive form can never exit.
  naive=$(pgrep -f "$tok" | wc -l | tr -d ' ')
  if [ "$naive" -ge 2 ]; then
    echo "  PASS  the NAIVE form sees $naive processes: the target AND the waiter"
  else
    echo "  FAIL  the naive form saw $naive, so the self-match was not reproduced"; fail=1
  fi

  # POSITIVE: the target ends, and the waiter must follow it.
  wait "$target" 2>/dev/null
  n=0
  while kill -0 "$waiter" 2>/dev/null && [ "$n" -lt 15 ]; do sleep 1; n=$((n+1)); done
  if kill -0 "$waiter" 2>/dev/null; then
    kill "$waiter" 2>/dev/null
    echo "  FAIL  the waiter OUTLIVED its target by 15s+: this is the hang"; fail=1
  else
    echo "  PASS  the waiter EXITED $((n))s after its target did"
  fi

  # And nothing is left behind, which is the whole point of the exercise.
  sleep 1
  left=$(pgrep -f "$tok" | wc -l | tr -d ' ')
  if [ "$left" = "0" ]; then
    echo "  PASS  zero processes carrying the token remain"
  else
    echo "  FAIL  $left process(es) left behind"; fail=1
    pkill -f "$tok" 2>/dev/null
  fi

  rm -rf "$tmp"
  [ "$fail" = 0 ] && echo "  self-test: 4/4" || echo "  self-test: FAILED"
  return $fail
}

[ "$1" = "--self-test" ] && { self_test; exit $?; }
[ -n "$1" ] || { echo "usage: $0 <pattern> [poll-seconds]" >&2; exit 2; }

poll=${2:-20}
while [ -n "$(matches "$1")" ]; do sleep "$poll"; done
