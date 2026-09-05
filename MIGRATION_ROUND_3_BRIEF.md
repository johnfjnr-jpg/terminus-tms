# Migration Round 3: the Commercials deal form

**Final, 2026-09-05. Ruled by John: this round migrates the deal FORM only;
the version machinery is Round 4. Ground: a 2,797-line surface moved in one
round produces a revert nobody can attribute.**

First partial-view migration: React takes one panel inside the
opportunity-detail view while vanilla keeps the view shell, the Reference
tab and the version machinery around it. And the computational pole
reverses: where the approval view computed nothing, this panel computes
live from the shared `src/lib` on every input, on purpose, so the round's
central proof is parity, not absence.

Method per the `tms-round-method` skill. Editor-slot derivation rules
apply; the contract and its three addenda govern the one click-to-edit
row and any new editor the direct inputs need.

---

## The proof obligation named up front

The vanilla panel's `recompute()` runs `resolveRates`, `buildDealInputs`,
`calculateDeal` from `src/lib` against `readPayload()`'s reading of the
DOM. The React panel imports the same three functions untouched.
Therefore the whole computational claim reduces to: **for identical
visible inputs, the React payload reader produces a payload deep-equal to
`readPayload()`'s.** Phase 2 proves this mechanically: a corpus of
payloads (Phase 0 enumerates the input space, including every latch
state) driven through both readers, deep-equal asserted, differences are
findings. Rendering parity is separate and visual; computation parity is
this, and it is exact or it is a defect.

---

## Phase 0: investigation (no product code)

1. **The panel boundary, measured.** Everything `app.js` does to the
   Commercials tab: mount call, tab show/hide mechanics, what happens on
   freeze and unfreeze (`applyLatches` interplay), what
   `oppCurrentVersionRejection` and `oppRefreshVersionActions` feed and
   when they are called. The React mount seam is designed from this
   measurement, not from the Round 1 whole-view pattern.
2. **The form/version seam, measured.** Exactly what crosses between the
   deal form and the version machinery in both directions: what
   `saveVersion` reads from the form, what `restoreVersion` writes into
   it, and what state they share. This seam is the Round 3/Round 4
   boundary and must be expressible as a small interface the vanilla
   version code can call into the React form during the interim.
3. **The input census.** Every input, select and latch on the panel and
   its tabs (deal, installation, cash flow, milestones, contractor
   milestones): id, type, section for dirty tracking, numeric semantics
   (`num`, `emptyToNull`, `numOrNull`, `numOrUndefined` each imply a
   different empty-state contract), and which inputs are
   salesperson-writable versus latched. The census is the corpus
   generator for the parity proof.

   **MEASURED 2026-09-05, and the figures below replace any earlier count.**
   **39 controls on the default tab** (35 text, 3 select, 1 textarea), before
   the detail panel's margin inputs. **`readPayload` reads 31 ids directly.**
   **Four empty-state contracts, which the corpus must CROSS rather than
   average:** `numOrNull` x16 (empty -> `null`), `emptyToNull` x2,
   `num` x2 (empty -> `0`, a value), `numOrUndefined` x11 (empty -> the key is
   ABSENT, which the record reads as deletion).
4. ~~**The one click-to-edit row**: locate it, confirm it is a contract
   row, and record which editor it needs.~~ **STRUCK 2026-09-05: the row does
   not exist.** Measured zero in the source, the markup region and the live
   panel; see `MIGRATION_ROUND_3_PHASE_0_REPORT.md` D1.
5. **Sectioned dirty tracking, measured.** `dealDirtyKeys`,
   `dirtySections`, `renderSectionSaves`, `captureSavedBaseline`: the
   form's dirty model is baseline-comparison at form level, not
   field-row drafts. Enumerate its behaviours the way the field-row
   contract enumerated rows, because this is a second dirty model and
   the React form must reproduce it, not unify it with the row model
   without a ruling.
6. **Coupled tests and probes, with the instrument recorded beside the
   count**, per the Round 2 close-out rule. `commercials-wiring.test.mjs`
   is expected to dominate; classify its blocks by what they assert
   (source-shape, stylesheet liveness, behaviour) since the re-point
   effort differs per class.
7. **Shell-global inventory for this file**, split `var`/`function`
   versus `let`/`const` per the promoted rule: what it reads from
   `app.js` scope, what it exposes, what the React panel must self-fetch
   (the catalog via `/api/base-costs` is already visible).
8. **Endpoint census**: every route the panel calls, and which parts of
   the payload round-trip through `saveDeal` versus live only in the
   form.

Phase 0 output: numbered report. Discrepancies stop the round.

---

## Phase 1: the mount seam and the form, migrated

- React mounts into the panel container on the same trigger vanilla used;
  tab mechanics, freeze banner and version list stay vanilla and
  untouched except at the measured seam. The interim seam interface from
  Phase 0 item 2 is implemented and is the only new coupling.
- The census inputs render through the editor slot where they are rows,
  and through form components where they are direct inputs; the numeric
  empty-state contracts from item 3 are preserved per input, not
  normalised.
- `recompute()` equivalent wired to the same lib functions; results,
  cash-flow grid, year schedule, milestones and installation tab
  rendered; the unfold ruling (one panel, one arithmetic story; total
  cost as the visible sum) preserved exactly as the vanilla comments
  record it.
- Sectioned dirty tracking reproduced per item 5's enumeration;
  `saveDeal` path preserved (payload shape, salesperson-writable
  filtering, revision handshake as measured).
- Latches applied per the measured freeze interplay;
  `detailLoaded` semantics preserved for the tab.
- Vanilla file stays in tree; load order gives the revert; the same
  three-part template governs every re-point in the same commit as the
  swap.

## Phase 2: the parity proof and re-derived tests

1. **Payload parity**: the census-derived corpus through both readers,
   deep-equal, including every latch state, every empty-state contract,
   and salesperson-writable filtering. Run against the vanilla reader on
   the rehearsal branch so both readers face the same DOM fixtures.
2. Behaviour tests derived from Phase 0's enumerations (dirty sections,
   saves, latches), not from either implementation.
3. Coupled assertions re-pointed per classification; calibration by
   injection with the verified-snapshot harness; final reverted run.

## Phase 3: walk, revert rehearsal, close-out

Walk on a real record including a frozen one; revert rehearsed (panel
reverts, view shell and version list unaffected, approval and Account
stay React); visual comparison at three widths with the clock-band
control; contract addendum updates if the row or slot learned anything;
rule promotion check; `CURRENT_STATE.md`; close-out with the Round 4
entry evidence: the seam interface as measured and implemented, the
parity corpus result, and the estate count with instrument.

---

## Exit gate for Round 4 (version machinery)

1. Payload parity: corpus deep-equal, zero unexplained differences.
2. The walk on live and frozen records passes; the revert is rehearsed
   and reverts the panel alone.
3. The form/version seam is implemented as measured, documented, and
   the version machinery still works untouched against the React form.
