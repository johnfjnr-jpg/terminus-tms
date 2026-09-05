---
name: tms-round-method
description: The Terminus TMS round discipline for executing build briefs. Use whenever executing a phase of a TMS build brief, writing a phase report, running the merge gate, calibrating a check, or closing a round. Encodes the session mechanics that CLAUDE.md's numbered rules assume.
---

# The TMS round method

`CLAUDE.md` is the rulebook and the authority; this skill is how a session
runs under it. Where they disagree, `CLAUDE.md` wins and the disagreement is
a finding.

## The loop

Brief in the repo, then phases in order, then a report, then sign-off, then
the next phase. Nothing is pushed without the explicit word. A round closes
on the word, never on the work feeling finished.

- Read the brief AND the governing docs it names before doing anything.
- Investigation phases produce reports, not fixes. Findings are named
  before fixed. A defect the change itself created is part of the change
  (build discipline 10's limit); everything else is recorded and queued.
- Where the brief is silent and an answer is needed, take a documented
  position under the standing delegation rule: implementation decisions go
  with the recommendation, recorded in the report with reasoning,
  revisitable. Scope beyond the brief, live data, auth, security posture,
  deployment, and new dependencies with commercial implications stop and
  wait for John.

## Evidence standards

- Every number describing a run is emitted by the run. A hand-typed count
  is a second reader and has already been caught wrong once.
- A claim of absence names the instrument that could have seen the thing.
  A grep that returns nothing is checked against a known-good pattern
  before it is read as absence, and comments are stripped first so prose
  cannot satisfy a match.
- Capture full output to a file and read the file. Filtered reads (tail,
  grep on the summary) have hidden the causal line three separate times in
  one round. The real cause is usually one line above the printed
  diagnosis.
- A fixture is built the way the SYSTEM produces the state, never the way
  the code under test happens to read it.
- Tests for a replacement are derived from the contract document or the
  brief's behaviour list, never from the component and never from the code
  being replaced. If a derived test disagrees with measured behaviour, the
  disagreement is a contract finding, not a licence to copy the source.

## Calibration

Every new check, guard, probe or gate stage is calibrated in both
directions before it counts as evidence: shown firing on an injected fault,
shown silent on the healthy state. A green suite on its first run is the
tell, not the proof; injection is what turns it into evidence.

The calibration harness itself:

- snapshots the actual bytes of every file it will touch, keyed by full
  path, and asserts the snapshot exists before injecting anything;
- compares restored bytes to the original after every injection and stops
  dead on mismatch;
- ends with a final full-suite "reverted" run. That line has caught its
  own broken harness twice; it is never skipped.
- Never use git checkout as the restore: it reverts to the last commit,
  and a mid-phase tree is not the last commit.

## The gate and the environment

- The gate runs on the exact tree being pushed, committed first.
- Uniform instant failures across network stages (about 130ms against
  normal 12 to 60 second timings) mean the environment, not findings.
  Check the session token and reachability before opening any failure.
- A database suite failing near-totally with very long timings is an
  environment signature. Test DNS resolution and TCP connect as separate
  named steps; they fail differently and the difference is the diagnosis.
  Record whether a VPN is active: a VPN resolver with a stuck entry is
  indistinguishable from the service being down until measured.
- A gate that cannot go green does not push, even when the diff from the
  last green tree is a markdown file. Do not reason a gate forward.
- A killed run leaves whatever it created; suspect residue, then verify
  rather than assume it.

## Reports

A phase report states: what was built, the evidence per claim with the
check named, every departure from instruction with the measurement that
justified it, every ambiguity with the position taken and the reasoning,
calibration results in both directions, and what surprised. What a result
does NOT establish is stated beside it.

Numbering schemes must not share a range in one document: a brief's points
and an enumeration's shapes colliding produced a false coverage claim.
Prefix or rename.

## Closing a round

- Reconcile every list against its source by counting, not by reading:
  walk points against the brief, commits against sign-offs, state diffs
  against the phases that moved them. An unaccounted line is a gap.
- Rehearse the revert on a branch, verify the tree byte-identical after,
  and record what the rehearsal found. A written procedure is a claim;
  a rehearsed one is a fact.
- Promote earned lessons to CLAUDE.md, checking first whether an existing
  rule already covers them; extend rather than duplicate.
- Regenerate CURRENT_STATE.md, run its staleness check, and state the
  result.
- The exit gate is answered point by point with evidence, then the round
  waits for the word.
