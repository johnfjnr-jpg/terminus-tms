# Round 10A fix brief: two Reference tab defects

Source of truth: `CLAUDE.md`, `CURRENT_STATE.md`, `DESIGN_PRINCIPLES.md`,
`ROUND10_BUILD_BRIEF.md`. Read all four before starting.

Two small defects found by the business using the merged Round 10 build.
This is a fix round, not a feature round. Both items are frontend only. No
gate rules change, no schema change, no endpoint change.

Work through phases in order. Stop after each, report evidence, wait for
sign-off.

---

## Phase 1: Summary renders twice

Round 10 Phase 2 moved Summary in line with the Test Bed name. **The
original Summary block below the panel row was never removed**, so it
renders in both places. Confirmed by the business from a live screenshot.

Investigate before fixing, and report:

1. Confirm both are genuinely rendering, and identify each one's source.
   The header instance was added in Round 10 Phase 2. Establish where the
   lower one comes from and whether anything else depends on it.
2. **Confirm they are the same field and not two different ones.** They
   should both be `summary`, but `data-key="summary"` appears on three
   Reference-style views, and Round 10 Phase 0 made a wrong inference about
   exactly that. Check the ids, not the attribute.
3. Report whether the lower block carries any behaviour the header
   instance does not, specifically whether it is editable and the header
   one is not, or vice versa. Removing the editable one and keeping a
   read-only one would remove the ability to edit Summary at all.

**Then remove the lower one**, keeping the header instance, per the
business's instruction.

**Why this was missed, and it belongs in the record.** Phase 2's evidence
confirmed Summary rendered in line with the name. It never confirmed the
old block had gone. That is the same shape as the eight wait-condition
faults recorded in Round 10: a check that verified the new state exists
without verifying the old state stopped existing. Record it in
`DESIGN_PRINCIPLES.md` as a distinct instance, because it is the first one
that reached a user rather than being caught by the person who wrote it.

**Test evidence required:** confirm exactly one Summary renders on the
Reference tab, at all three widths. Confirm Summary is still editable and
that an edit persists, verified server-side. Confirm the header instance
still wraps correctly at 1240px, per Round 10 Phase 2's measured behaviour.
Screenshots before and after. Open them and look.

---

## Phase 2: Customer Details row heights

The COMM. BUYER row sits lower than the rows around it, so row spacing in
Customer Details is uneven. Confirmed by the business from the same
screenshot.

**Likely cause, to confirm or refute before fixing:** Round 10 Phase 3.1
removed the "CLIENT BUYERS" grouping label. If its container or its margin
survived the label's removal, the space it occupied is still there.

Investigate first. Report what is actually producing the extra height
before changing anything. Do not add a negative margin or a fixed height to
compensate for a stale element that should simply be gone.

**Test evidence required:** measure the computed height of every row in the
Customer Details panel, before and after, and confirm they are equal.
Measure rather than assert, and measure the rows themselves rather than
inferring from the panel height. Confirm the panel's total height reduces
by the amount removed. Confirm no label or value truncates in the narrowed
panel at any of the three widths, since Round 10 Phase 3 left the buyer
select at 188px with 130px needed and that headroom must not shrink.
Screenshots at 1240px, 1920px and 3440px.

---

## Phase 3: Regenerate and reconcile

Re-run `scripts/state-dump.mjs` and commit the regenerated
`CURRENT_STATE.md`.

**Nothing in this round should move any configuration section.** No gate
rules, no reference docs, no writable keys, no routes, no migrations. A
change in any of those is a defect, not a delta to explain.

Expect only the timestamp, the SHA, record counts and harness accumulation
to differ.

**Test evidence required:** the full diff, with every hunk accounted for.
`npm test` and `npm run test:db` both passing.

---

## Documentation discipline

Update `DESIGN_PRINCIPLES.md` as decisions change. Two things to record:

- **Phase 1's cause**, per the note above.
- **Phase 2's finding**, whichever way it resolves. If a removed label left
  its container behind, that is worth knowing before the next label change.

Check the phase count against this document with
`grep -n "^## Phase"` before declaring the round complete.

---

## Round 10A outcome

All 3 phases built and signed off: 1, 2, 3. Checked with the corrected
`grep -n "^## Phase\|^### Phase"` against this document per rule 7, which
returns 3 headings and no sub-phases. **The correction made no difference on
this brief**, because it has no `###` phases. It is recorded here so the
next round does not read a matching count as evidence the correction was
unnecessary; it was corrected because it undercounted `ROUND10_BUILD_BRIEF.md`
by two.

Both defects were found by the business on the merged Round 10 build, not by
a check in this project. Both were introduced by Round 10 itself.

| Phase | Delivered | Beyond the brief |
|---|---|---|
| 1. Summary renders twice | Lower block deleted, header instance made click-to-edit through `openTbField`, exactly one Summary renders at all three widths | **The brief's instruction was wrong and investigating first caught it.** The lower block was the editable one; the header instance was read-only, so removing the lower one as instructed would have removed the only way to edit Summary. Fixed by moving the control rather than the display, which meant **deleting `renderTbHeaderDigest`** rather than working around it: it rebuilt `#tb-header-summary` on every render, which is precisely why the header could only ever be read-only |
| 2. Customer Details row heights | Stale `margin-top:16px` wrapper removed, gaps `[40,57,40,41]` to `[40,41,40,41]`, card 279px to 263px | **The rows were never uneven.** Every row measured 41px before and after; the defect was the gap, and measuring the rows rather than inferring from the panel height is what separated it from a second defect sharing the same symptom. The empty Customer Details panel is **separate**: a 650ms async window in `renderTbBuyerRows`, established before either was touched |
| 3. Regenerate and reconcile | `CURRENT_STATE.md` regenerated, every hunk attributed, all 11 configuration sections **byte-identical** to the committed copy | The record-count deltas are **not all this round's**. A live Test Bed moved Qualification to Closed with nine documents and sixteen approvals between 08:18 and 08:34 UTC, owned by `john@terminustechnologies.io`: the business using the merged build while the fix round ran |

### The two findings worth keeping

**1. Investigate-before-fixing earns its cost precisely when the instruction
sounds most certain.** The brief said remove the lower Summary and keep the
header one, stated as settled fact and confirmed from a live screenshot. It
was wrong in the one way that mattered, and following it would have shipped a
Summary field nobody could edit. **Certainty in a brief reflects the author's
confidence, not the code's state**, and the two are independent. This is now
the second consecutive round in which a briefed instruction was refuted by
the phase that investigated it: Round 10 Phase 0 returned three of six items
against the brief's premise. Both times the disagreement was the phase
working, not the phase being difficult.

**2. Two removals in one round left their containers behind, and both were
verified the same wrong way.** Round 10 Phase 2 moved Summary and left the
original block; Round 10 Phase 3.1 removed the "CLIENT BUYERS" label and left
the `div` that existed only to carry it. **Both were verified by confirming
the intended new state existed, and neither by confirming the old thing had
gone.** Every assertion made was true. Summary did render in line with the
name; the label genuinely was absent.

Two instances in one round argues this is a default rather than an oversight.
The natural evidence for a change is a screenshot or a measurement of the
thing you built, and both are taken at the destination; **nothing about
producing that evidence ever directs attention to where the thing used to
be.** The remedy is the relocation form now in `CLAUDE.md` Verification rule
7: **assert the count, not the presence.** Exactly one Summary renders, not
at least one. Zero elements match the removed container's selector, not "the
label is gone" - which the buyer wrapper passed, since after the label went
it displayed nothing at all.

Both of these reached the business. They are the first defects in this
project to do so.

### Open, carried forward

Round 10's seven open items stand unchanged. Three added:

8. **Customer Details shows no buyer rows for 650ms after the record
   renders.** `renderTbBuyerRows()` awaits a contacts fetch with nothing
   marking the interval. Same class as Round 10 Phase 5A's stage panels,
   which makes the pending-state pattern **a pattern to apply across every
   async renderer rather than a fix to make panel by panel**. The pending
   marker must never be the thing a check waits on.
9. **`GET /api/contacts` fetches every contact and filters client-side**, on
   `parent_record_id === account_id`. This is why the wait is 650ms rather
   than tens of milliseconds, and it is **a scaling problem rather than a
   fixed cost**: it worsens with every contact added anywhere in the system,
   regardless of how many belong to the Account being viewed. 161 contacts
   today, 9 of them live.
10. **Every `.ref-field` overflows its own box by 4px**, on all four
    Reference tab panels including plain read-only rows. Pre-existing,
    identical before and after this round, nothing visibly clipped at any
    width. Not fixed, because `.ref-field` is shared by four detail screens
    and this was a two-defect fix round. Recorded because it is **a standing
    4px of false positive in exactly the overflow check this project relies
    on**, so 4 is the floor rather than a finding.
