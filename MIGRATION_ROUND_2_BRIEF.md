# Migration Round 2: first contact - the Account surface

**Final, 2026-09-05.** Decisions ruled by John this date: the first surface
is Account, deviating from Round 0's Commercials-next order on measurement
(fourteen rows in 308 lines against Commercials' one; the inbound-reference
count that ordered Commercials first was inflated by self-generated
strings). Commercials moves to Round 3 and migrates with a row primitive
proven in production. And Accounts remain editable by any user who can see
them: the vanilla surface has no ownership door, that is now a deliberate
ruling rather than an unexamined default, revisitable if account content
becomes commercially sensitive.

This round is the field-row component's first contact with production: the
Account surface, 308 lines. **The structure is the measured one, corrected at
the Phase 0 close: 14 click-to-edit rows, 2 read-only rows (the parent-account
link widget IS one of them), and 1 name-header editor that is NOT a row - it is
an `<h1>` outside any `.ref-field`, with no tab stop. 17 elements in total.**
The earlier "fifteen rows and two read-only rows" folded the header into the row
count and listed the parent widget separately from the read-only row it is. The
eleven
findings in `MIGRATION_FIELD_ROW_CONTRACT.md`'s addendum are the
first-contact checklist, revisitable on evidence from this round. Commercials
follows in Round 3 with a row primitive already proven.

Method per the `tms-round-method` skill and `CLAUDE.md`. Component and test
derivation remains from the contract documents; vanilla source is consulted
only after a derived test disagrees with measured behaviour, and the
disagreement is recorded as a contract finding.

---

## Preconditions

1. `.claude/skills/tms-round-method/SKILL.md` is present, committed and
   pushed. It was placed locally at Round 1 close and never committed; an
   untracked method file is one clean from gone. Verify the skill loads in
   this session and say so in the Phase 0 report.
2. The 19-stage gate is green on `origin/main` HEAD before any work.

---

## Rulings taken at the Phase 0 close, 2026-09-05

Recorded here so Phase 1 builds against them rather than against the brief as
first written.

### D3. `CURRENT_STATE.md` is the SERVER-AND-CONFIG state document

Phase 0 measured that `scripts/state-dump.mjs` does not read `frontend-react/`
at all, so putting it on the staleness watch list would report FALSE staleness:
a change there cannot make the document out of date, because the document does
not describe it.

**`frontend-react/` is deliberately NOT watched.** The watch list stays the
generator's own inputs.

**But the document must not be SILENT about a whole workspace.** The generator
gains a minimal React section: the bundle's **sha256** and the **React suite
count**, both **run-emitted, never typed**. Enough that a reader knows the
workspace exists and which bundle is committed; not so much that the document
starts describing a build it does not own.

### D-BLOCK. Route 3: the descriptor-declared editor slot

Three of the 14 rows are `<select>`s and the contract excludes field-specific
editors in writing. Ruled: **route 3**, and it is the implementation of the
contract's own sentence rather than a departure from it.

> *"Field-specific editors. Dates, staff pickers, currency and the numeric guard
> are per-field concerns LAYERED ON the row, not part of it."*

**The row owns state, the door, dirty and keyboard. Editors are pluggable. Text
and select are the first two.** Dates and currency arrive in Round 3 without
another refactor, which is why this is cheaper than a sibling component even
though it is more work today.

**The 49 existing field-row tests must pass UNCHANGED through the refactor.**
They are not edited to fit it. A failure means the refactor moved behaviour, and
that is a finding, not a test to adjust.

### Item 9. The guard's wiring

`canEditFields()` returns **true for `account-detail`** and **false for any
surface not yet ruled**.

A global `() => true` would be a claim about every surface, including Opportunity
and Test Bed, which DO have doors and which Round 3 migrates. Addendum finding 10
makes an unwired guard fail closed; a wrongly-wired one fails **open**, which is
worse. One line per surface as each is ruled.

---

## Phase 0: investigation (no product code)

### Inherited from Round 1, all six

1. **The `CURRENT_STATE.md` staleness watcher** watches
   `supabase/migrations`, `supabase/seeds` and `src/routes` only, and is
   blind to `frontend-react/`. Extend the watch list; state what it now
   covers and why.
2. **`refresh-session.js` prints a hardcoded diagnosis on every failure**
   ("the refresh token has expired too"). Print the caught error and let
   the diagnosis be the reader's. Calibrate: a network failure and a
   genuinely expired token must read differently.
3. **The session pre-stage validates only at the start of the gate.** A
   gate can outlive its token. Decide and implement the cheaper of:
   re-validate before the HTTP block, or extend the session at gate start.
   Record the position.
4. **Environment failures are unlabelled.** Add a reachability pre-check
   before the database suite: DNS resolution and TCP connect as SEPARATE
   named steps, plus a recorded note of whether a VPN is active. On
   failure it fails alone, saying "environment, not findings". Calibrate
   both directions.
5. **Two numbering schemes shared a range** (brief points vs Phase 0
   shapes) and produced a false coverage claim in the Round 1 close-out.
   Rename one scheme in this and future briefs: brief points are P1..Pn,
   enumerated shapes are S1..Sn. Declared here, applied from Phase 1's
   outputs onward.
6. **Commit the method skill** if precondition 1 found it untracked.

### This round's own investigation

7. Enumerate the Account surface completely: every row on every tab (the
   contract counted the default tab only), the parent-link widget's three
   functions, the name-header editor, the save path and its payload shape,
   and the revision handshake if the surface has one.
8. Enumerate every test and probe coupled to `frontend/account-detail.js`
   by path or source assertion, and every inline reference in
   `index.html` markup (two known: the name header's open and discard).
   These are the revert surface and the re-pointing list.
9. **The guard's reading** (addendum finding 9 deferred this here):
   confirm by measurement that no ownership door exists on the vanilla
   Account surface - `openAcctField` carries no check and `app.js` never
   sets `is-not-mine` on the Account view. Then implement the ruling:
   the shell's `canEditFields()` returns true on the Account surface, and
   Accounts are deliberately editable by any user who can see them. The
   guard is still WIRED, returning true, never omitted: finding 10's
   fail-closed default means an unwired guard refuses everything, and a
   wired always-true guard is one line to change when the ruling is
   revisited.
10. Field descriptors for all Account fields: labels, inputmode
    declarations, read-only flags, drawn from the enumeration in item 7
    and checked against `src/lib/field-validation.js` where it speaks.

Phase 0 output: numbered report. Discrepancies stop the round.

---

## Phase 1: the Account surface, migrated

- React owns `#view-account-detail` the way it owns the approval view:
  the bundle registers the loader, the vanilla script tag and the two
  markup onclick attributes are removed in the same commit, the vanilla
  file stays in tree unloaded, and the revert is enumerated in item 8's
  terms before the work starts.
- The 14 click-to-edit rows and 2 read-only rows render through `FieldRow` and
  `useFieldRows`, descriptors from Phase 0 item 10; the name-header editor
  renders as itself and shares the surface draft store, as measured. Three of
  the 14 use the SELECT editor (`terminusLead`, `billingRegion`,
  `shippingRegion`). No vanilla class
  names copied (addendum finding 11); the consuming surface decides
  styling, and this one styles to match the current rendering because
  pixel parity remains the default.
- The name-header editor and the parent-link widget are rebuilt in the
  React tree. The parent search calls the same routes; nothing computed
  client-side that the server already computes.
- The edit bar aggregates across the surface including the name header
  if the enumeration shows it shares the draft store; if it does not,
  that is a finding, not a silent unification.
- Save semantics stay the record's concern: one payload, the existing
  route, the existing revision handshake if item 7 found one.
- `detailLoaded('account-detail')` on every exit path.

**First-contact checklist, run and reported finding by finding:** each of
the addendum's eleven positions is confirmed, amended or overturned by
this surface's behaviour, in writing. An amendment is a contract addendum
entry, not a quiet code change.

---

## Phase 2: tests re-derived, assertions re-pointed

1. Component and surface tests derived from the contract plus Phase 0's
   enumeration, per the standing rule. The walk recipe from the
   contract's closing section is the verification: for each of the
   seventeen elements - open, type, discard, reopen, type, save - plus
   confirmation that no row refuses, the always-open door acting as
   ruled.
2. Every coupled assertion from Phase 0 item 8 is rewritten with the
   Round 1 three-part template: re-point off the dead file, measure the
   premise while there, assert both sides individually so the last
   vanilla consumer's departure fails the test as an instruction to
   delete it.
3. Calibration by injection for a representative subset, with the
   verified-snapshot harness. The final reverted run is never skipped.

---

## Phase 3: walk, revert rehearsal, close-out

1. The walk on a real record: all seventeen elements by the contract recipe,
   the parent link, the name header, the save round-trip, on the live
   server. Fixture torn down, residue check across record types.
2. Revert rehearsed on a branch: script tag restored, markup onclick
   attributes restored, bundle tag removed - the enumerated revert from
   Phase 0 item 8, however many edits it truly is. Gate on the reverted
   state, tree byte-identical after discard.
3. Contract addendum updated with first-contact results. Rule promotion
   check. `CURRENT_STATE.md` regenerated with the extended watcher, and
   the staleness check run and stated.
4. Close-out report carrying the Round 3 (Commercials) entry evidence:
   the seventeen-element walk, the checklist verdict on all eleven findings,
   and the re-pointing count against the remaining coupled assertions.

---

## Exit gate for Round 3 (Commercials)

1. All seventeen Account elements pass the contract recipe on the live
   server, and the revert is rehearsed.
2. Every one of the eleven findings has a written first-contact verdict:
   confirmed, amended (with the addendum entry), or overturned (with the
   component change and its re-derived test).
3. The coupled-assertion count for the estate is restated: how many of
   the original 106 remain, so the migration's tail is measured rather
   than felt.
