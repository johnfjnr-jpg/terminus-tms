# TEST BED STATE: Phase 1 report

Branch `round-testbed-state`. Three items ruled, three built, three
committed. Nothing pushes.

## What is NOT built

Nothing from Phase 1's scope is carried. R1, R2 and R3 all landed in
full. The carried items below are pre-existing and were not in scope.

## R1 - lift `useFieldRows` to `TestBedHost`

**Two parts, both landed.**

`StageTabs` renders each pane conditionally (`StageTabs.tsx:210`), so
leaving Reference unmounts `TestBedPanel`. While the panel owned the
store, the store went with it and **every unsaved edit was discarded**.
The controller now lives on the host, above the tabs.

With the store lifted, Sensor Counts and Commercials moved to the
Commercials tab, which had been rendering `null` while those two cards sat
at the bottom of Reference below eight others.

**A portal could not have done it**, which is worth recording because the
brief proposed one: `StageTabs` unmounts the Reference pane, and a portal
dies with the tree that renders it rather than with the container it lands
in. The lift is what made the honest version possible.

### Two defects this change created, and therefore part of it

**The edit bar.** It was the last child of the Reference panel, so it
existed only while Reference was open. A person could type a cost on
Commercials and have **no Save and no Discard**. Found by a live probe; no
assertion could see it, and there is one now. The contract already says the
bar is a property of the surface rather than of a row, and the surface is
now two tabs sharing one store, so the bar moved to the host with it. Its
id is unchanged, so the walk that clicks it by id is unaffected.

**The card gap.** The two moved cards sat in a bare `div`. `.pg-card` has a
border and no margin, so they rendered flush and their borders merged into
one box with two sections. Found by opening the screenshot. They now use
`.ref-cards`, the class every other card pair on this record uses.

### Evidence

| claim | check |
|---|---|
| an edit survives a tab switch | jsdom, host driven through one root re-rendered |
| ONE store, not two | the dirty count survives with the value |
| the cards are GONE from Reference | count 0, with the panel asserted present |
| exactly one of each on Commercials | count 1, inside that pane |
| the moved cards share the store | a cost typed on Commercials survives a trip |
| the bar exists on EVERY tab | count 1 on both |
| a cost on Commercials reaches the save | the real PATCH, not a stub |

**Calibration, snapshot-keyed by full path with a byte-compared restore:**

```
panel builds its own store     -> FIRED 'was DISCARDED by a tab switch'
                                        'the count reset'
dateBounds gets a 2nd store    -> FIRED 'ignored an unsaved install date'
cards left on Reference too    -> FIRED 'Sensor Counts is STILL on Reference'
commercials slot back to null  -> FIRED 'did not arrive, or arrived twice'
moved cards get own store      -> FIRED 'the moved card has its OWN store'
bar back inside the panel      -> FIRED 'the moved cost rows have NO WAY TO SAVE'
reverted                       -> pass, files byte-identical
```

**Live probe 16/16 at 1440.** Cards absent from Reference; exactly one each
on Commercials and inside that pane; real geometry; 16px between them; a
cost typed on Commercials surviving a trip to Reference and back; the bar
still counting it as 1 change.

### A silence that named an unasserted claim

The first calibration injection gave `dateBounds` its own store and came
back **SILENT** while every other injection fired. Nothing asserted that
the date bound follows a **live draft** rather than the saved value. That
was true, relied on, and asserted nowhere. It is asserted now, and the
same injection then fired.

## R2 - the follow-up task on a Test Bed

A date and a description, the same two payload keys the Contact surface
uses, on the same write path, rendered by the same shared component.

**The write path, measured in both directions:**

```
before  PATCH /test-beds/:id -> 400, disallowed
        ["followUpDate","followUpDescription"]   (the REASON, not the status)
after   200, both values read back off the record, revision 1 -> 2,
        and warrantyPct STILL refused
```

The server runs without `--watch`, so it was restarted between those two
readings. Without that, the "after" probe would have measured the code the
edit had just replaced **and would have passed**.

### A defect this change created, and therefore part of it

Follow-up is the third cell, so `.tb-top-row`'s scoped two-column override
is gone and the row inherits the three-column grid. That took the Summary
card's value column **from 228px to 58px** and wrapped its own placeholder
over four lines. `style.css`'s comment records the identical defect on the
identical card: the Contact surface hit it and fixed it with
`.cd-row-nolabel`. Taking that class rather than minting a Test Bed
equivalent is the point.

The typechecker caught `.map(row)` handing `Array.map`'s **index** in as
the new label-override parameter, which would have silently relabelled
every mapped row with a number.

**Live probe 10/10 at 1440**, including three cells sharing one row -
`.lead-card-body` is a three-column grid, and a fourth cell would wrap to a
second row while every count assertion still passed.

## R3 - notes and audit are two separate concerns

`payload.notes` is what a person wrote; a field changing is something the
system observed. The route now diffs the patch against the payload it
actually holds and writes `{changes: {field: {from, to}}, revision}` to
`audit_log`. One differ, shared by both routes. A display renderer
composes the sentence, so what is stored stays data.

**A caller may not author its own audit.** The old sentence was composed
from a record loaded at some earlier moment and nothing checked it against
what was stored - Architecture 12 one layer up: derive, do not accept.

### The collision, reported rather than quietly resolved

`contacts.js` carries a comment recording Round 17A **deleting a read from
exactly the spot this change adds one**. It is a different read and the
difference is what it feeds:

- the removed read built the **merge** in the browser's process, so two
  concurrent writes could each merge onto the same base and one would be
  lost;
- the merge still happens inside `append_record_revision`, untouched. This
  read feeds only the **audit diff**, so the worst a concurrent write can
  do is make a `from` value one revision old.

Where the client sends a revision, even that cannot happen: the append
carries the precondition, so a moved record is refused and no audit row is
written. `test-beds.js` needed no new read - it already reads the payload.

### The brief's number disagreed with the measurement

The brief said **20** existing mixed entries. Measured: **8**, all on
contacts, none on test beds, alongside 25 genuine human notes across 15
records. Left in place per the ruling. The disagreement is reported.

### Evidence, both surfaces - the blast radius the ruling named

**Live probe 28/28.** Per surface: one structured row per changed save; a
diff not the patch; `from` and `to` present; `to` matching what was
written; `payload.notes` untouched by a field save; a no-change save
writing no row; and the human note path still writing, with no audit row
and the history preserved.

```
log the patch instead of the diff  -> FIRED
un-exempt notes                    -> FIRED
rename the action                  -> FIRED
reverted                           -> 28/28, three files byte-identical
```

Each injection restarted the server, because it runs without `--watch`.

### Two instrument faults the calibration found

- **The harness scored a run that produced NO VERDICT as a silent
  detector.** The probe had crashed on an empty diff. It stops dead on an
  unparseable run now (Verification 48).
- **`logged < sent` is satisfied by zero**, so the DIFF check passed on a
  run where nothing was logged at all (Verification 14). Both sides must
  exist before they are compared.

And a fixture fault: the probe hardcoded the contact's name as
`<tag> contact` where the fixture stores `<tag> Contact`, so the
"unchanged" key genuinely changed. It is read from the record now.

## The added R3 check: is the Test Bed write path owner-only?

**Yes, and it is a real gate.** A non-owner PATCH returned **403,
ownership-shaped**, and the revision was **unchanged 11 -> 11** - no write
landed. No door gap. The premise the ruling rests on holds.

## Process faults in this session, recorded

- **The round branch did not exist when Phase 1 began.** Work started on
  `main`, against build discipline 9. Corrected mid-phase: the branch was
  created and the tree moved with it, so `main` never carried a commit.
- **The journal guard refused a commit**: a test file had been edited with
  a heredoc rather than through `scripts/edit.mjs`. Reverted to its
  committed state, both edits re-applied through the tool, and the result
  compared **byte-identical** to the file the probes had measured. The
  guard catching its own author again.
- **A document-wide selector** in the R2 probe typed into the **Contact**
  surface's follow-up card in a hidden view. Scoped.
- **A calibration matcher** read SILENT with two failures until it was
  re-anchored on the test's **first** assertion - a test aborts at its
  first failure.

## Carried, not fixed

Per build discipline 10, these are pre-existing and were walked past:

- `Convert to Opportunity` (`ConvertPanel.tsx`) is an unstyled white
  browser default on a dark screen. It joins `Link to Account` and
  `Save task`.
- `StageActions` outside the conformance gate.
- `(d)` full `ContactHost` retirement, unscoped.
- Navigation-state survival; teardown population dependency; the
  Commercials tab not switching under a probe.

## Gate

**All 24 stages passed**, on the exact committed tree
`90af487`, run as the final act with nothing else running.

```
pure suite       554/554      database suite   102/102
react typecheck  clean        react suite     1025/1025
eleven HTTP probes, the readonly-view probe, the bundle
freshness check and CURRENT_STATE staleness: all green
```

**The first run was 23 of 24**, and the failure was correct rather than
incidental: R3 edited `src/routes/contacts.js` and
`src/routes/test-beds.js`, both watched sources, so `CURRENT_STATE.md`
no longer described the tree. Regenerated, its diff reconciled, committed,
and the gate re-run green.

### What the CURRENT_STATE diff turned up

Every line was a count, and one pair needed explaining rather than waving
through: total live **128 -> 129**, with `test_bed | Qualification`
**1 -> 2**.

**That extra live test bed is not this round's residue.**
`TT-SGP-SMARTC-119`, *"looney tunes cartoons RR TB"*, was created
`2026-09-15T01:56Z` - about five and three quarter hours **before this
round's branch existed** - and is owned by `ae65b6ef`, an account distinct
from the business's `75425a02`. The previous generation was at Group A's
report the night before, so everything in between lands in this diff.

Reported, not acted on: it is live data owned by somebody else, and build
discipline 10 puts it on the list. **What I cannot answer from here is
whether `ae65b6ef` is a real person's account or a test one**, and that
distinction is the whole of Verification 11's residue question.

**This round's own fixtures are clean.** Zero live records carry any of its
tags, and zero live records have been created since this session began -
re-queried after teardown rather than trusted from the delete's own result.
Live total now 129, matching what `CURRENT_STATE.md` records.

## What this does NOT establish

- The 8 existing mixed note entries are **untouched**, by ruling. Anyone
  reading a contact's notes history will still see field-change sentences
  written before this round.
- `fields_changed` rows are written by the two PATCH routes only. Other
  write paths on these records - transitions, approvals, scores, links -
  keep whatever audit they already had, unchanged.
- The Opportunity surface was not in scope and still composes nothing;
  it was not measured.
