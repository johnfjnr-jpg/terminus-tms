# Payment Terms correction round: the brief

Branch `payment-fix`, off `main` at `9953d54`, confirmed equal to `origin/main`
by `git ls-remote` against the real remote rather than the local tracking ref.

Rule 18 and build discipline 19 govern: **this round ends "ready for John's
push"** and nothing is pushed from the session.

---

## THE STANDING RULE, John, 2026-09-25, verbatim

> build ONLY the named findings. Where a measured constraint forces a layout
> choice the brief does not cover, STOP and photograph the options for John's
> ruling. Never ship an unrequested arrangement.

**It is stated first because it decided the shape of this round.** Two of the
six items stop against it, and a third is stopped by its own condition.

---

## The findings, as received

| | |
|---|---|
| **F1** | the OPEX/CAPEX control IS the PO Factoring toggle: same component, same dress, same size |
| **F2** | the recovery radios align on ONE gutter |
| **F3** | under Hybrid the hosting breakdown renders EXACTLY ONCE. Census every renderer of the hosting schedule per mode and structure; collapse to one; the guard asserts one render in EVERY structure (single, two-phase, hybrid, OPEX), not just one |
| **F4** | the Invoicing radios (Annual in advance / Monthly) join the rail beneath the recovery radios, same gutter, same alignment. Recovery period stays with them |
| **F5** | Hybrid layout: customer payment milestones table and the hosting breakdown side by side as before the rail round, top-aligned, beside the rail. If they cannot both fit at 1240 beside the rail, STOP and photograph options per the standing rule |
| **R-PT3** | Single phase is REMOVED from CAPEX. CAPEX offers Two-phase and Hybrid only; OPEX is the single-phase mode. Phase 0 counts live deals saved as CAPEX single phase and reports them; they LOAD as OPEX (same economics) with the mapping recorded, no silent data rewrite: the stored structure key migrates explicitly and the migration is listed in the report. **If the count includes issued versions, STOP and report before touching anything** |

**F1 AND F2 REACHED THIS SESSION ELIDED.** The round's instruction survived a
context compaction, which rendered both findings with a trailing `...` where
text had been cut. Their cores are unambiguous and are what has been built:
one shared component at the same dress and size, and one gutter. **Anything the
elision removed has NOT been built and is not guessed at.** Recorded here
rather than discovered at the close, per build discipline 7.

---

## THREE STOPS, AND THEY ARE THE DELIVERABLE

Named in this file before any account of what was built, per build discipline
15: the first section about an unfinished item says it is unfinished.

1. **R-PT3 is STOPPED on its own condition.** The census found issued versions
   in the affected set. Nothing has been touched: Single phase is still offered
   under CAPEX, and no migration has been written.
2. **F5 is STOPPED on its own condition.** Measured, the pair cannot fit beside
   the rail at 1240 or at 1440. Options photographed.
3. **F3 is STOPPED WITH F5, because it cannot be executed without answering
   it.** Collapsing two renders to one requires choosing which container keeps
   the schedule under Hybrid, and that choice IS the F5 arrangement. The
   non-Hybrid half is a correctness fix with no arrangement in it and is built.

---

## THE PHASES, RECONCILED BY COUNTING

Counted from the commits on this branch, not read off this file. Build
discipline 7: the brief is not a reliable source for the count, and a phase
list does not reliably live in a brief as headings.

| Phase | Commit |
|---|---|
| The brief, John's findings and the standing rule verbatim | `361d7d3` |
| F1, F2 and F4: one toggle component, one gutter, invoicing in the rail | `6a43b64` |
| F3 and F5 are STOPPED, with the options photographed | `f84a361` |
| Close-out | this commit |
| `CURRENT_STATE.md` | the next |

**Rulings in force: 2**, and both are in this file above: the round
instruction (F1 to F5 plus R-PT3) and the standing rule. Neither was ruled in
conversation after the round began, so nothing had to be appended late.

---

## DISPOSITION, ITEM BY ITEM

| | Disposition |
|---|---|
| **F1** | **BUILT.** One `DealToggle` worn by both controls. Supersedes L1's flanking labels and the slider direction fix, both left visible at the site |
| **F2** | **BUILT.** One gutter, spread 0px across five rings at both widths |
| **F3** | **STOPPED with F5.** Measured and located; the collapse cannot be made without choosing the F5 arrangement |
| **F4** | **BUILT.** Invoicing, recovery input and recovery readout in the rail; the top row and Hybrid's duplicate group retired |
| **F5** | **STOPPED on its own condition.** 806px needed against 453px. Three options photographed |
| **R-PT3** | **STOPPED on its own condition.** The set includes issued versions. Nothing touched |

**What F1, F2 and F4 do NOT establish:** nothing about the Hybrid arrangement,
which is the whole of F3 and F5. The Hybrid screenshots in the live run show
the DOUBLE RENDER, because that is what the tree still does.

---

## THE CALLERS OF WHAT F1 RETIRED, WITH A DISPOSITION EACH

Verification 41: the enumeration is the instrument. Grepped across the whole
repository as a STRING, not only as a path, because a claim inside a data
structure used as documentation cannot fail and cannot be re-pointed.

| Caller | Disposition |
|---|---|
| `frontend-react/src/__tests__/opex-layout.test.tsx` L1a/L1b/L1d | **RE-POINTED.** The order claim is gone because there is nothing to be between; the other claims survive against the new control |
| `frontend-react/src/__tests__/deal-section5.test.tsx` P7 and the structure tests | **RE-POINTED.** P7's claim got stronger: one group, so nothing to disagree with |
| `frontend-react/src/__tests__/deal-surfaces.test.ts` | **RE-POINTED** for the two retired visibility flags |
| `scripts/tests/transition-requests.test.mjs` W-E | **RE-POINTED**, and section5 is now asserted NOT to write the treatment itself |
| `scripts/tests/commercials-wiring.test.mjs` FINDING 3 | **RE-POINTED** to assert the retired containers stay retired |
| `scripts/opex-layout/probe-live.mjs`, `calibrate.mjs` | **UNWIRED, left standing.** Both read the flanking labels and neither is a gate stage. They belong to L1's round and measure a control that no longer exists |
| `scripts/slider-direction/probe-knob.mjs`, `calibrate.mjs` | **UNWIRED, left standing.** Same: the knob-direction claim lost its subject |
| `scripts/payment-rail/probe-live.mjs` | **UNWIRED, left standing** |

**The unwired probes are named rather than deleted or fixed**, and that is a
position rather than an oversight: they are the evidence for rounds already
closed, they cannot fail a gate, and rewriting them would be rewriting the
record of what those rounds measured. **They will not run green again**, which
is the honest state and is recorded here so nobody reads their silence as
health (Verification 9's clause on a detector nothing schedules).

---

## A CARRIED OBSERVATION, NOT BUILT

`SwitchButton` in `panelParts.tsx` writes `btn-ghost deal-toggle` itself, so
the gross-up control reaches the treatment by a third route. F1 names the
payment-mode control and the factoring control, and the standing rule says
build only the named findings, so this is recorded and queued rather than
folded in.

---

## Standing method

- Measurements on the LIVE surface, never inferred from source.
- Layout claims stated as a RELATIONSHIP between two elements, never as a CSS
  property, and asserted on the leaves rather than on a container.
- Every screenshot opened and read, with the element proven inside the
  captured region AND visible.
- Every new guard calibrated both directions, and a SILENT injection explained
  rather than ignored.
- Commits at every phase boundary. Nothing pushed.
