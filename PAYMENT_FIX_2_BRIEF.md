# Payment Terms completion round: the brief

Branch `payment-fix-2`, off `main` at `cbd28e3`, confirmed equal to
`origin/main` by `git ls-remote` against the real remote rather than the local
tracking ref.

Rule 18, build discipline 19 and the standing named-findings-only rule govern:
**this round ends "ready for John's push"** and nothing is pushed from the
session.

---

## THE RULINGS, John, 2026-09-26, verbatim

> **R-PT3 RULED:** Single phase is removed from CAPEX for all NEW pricing (rail
> offers Two-phase and Hybrid under CAPEX). The two live records
> (TT-SGP-SMARTC-003, TT-SGP-MANUFI-005) migrate their CURRENT structure to
> OPEX as an EXPLICIT revision each (visible in the revision log, reason
> recorded), no other record touched, count re-verified before writing. Issued
> versions are NOT touched (the trigger stands guard); each frozen snapshot
> keeps its own structure key. PROVE the interpreter outlives the option: after
> migration, open one of the issued single-phase versions on the approval page
> and assert its figures still price from the frozen snapshot (non-zero,
> matching a direct derivation run over that snapshot). The derivation's
> understanding of `single` is recorded as permanent in the brief.

> **F5/F3 RULED, OPTION A:** under Hybrid, customer payment milestones and the
> hosting breakdown sit SIDE BY SIDE at FULL CARD WIDTH below the rail row,
> top-aligned; the hosting schedule renders EXACTLY ONCE, collapsed into the
> Hybrid grid; the guard asserts one render in EVERY structure and mode, and
> the empty area beside the rail under Hybrid is accepted per the ruling. The
> false prior-round comment claiming single render is corrected at its site.

---

## PERMANENT: WHAT `single` MEANS TO THE DERIVATION

**Recorded here because the option is being removed from the screen and the
meaning must not go with it.** Read from the source, not recalled.

| Site | What `single` does |
|---|---|
| `src/lib/deal-calculator.js` | `const recov = structure === 'single' ? months` - **the recovery period IS the full contract duration.** Two-phase reads `recoveryMonths`; hybrid has no recovery period at all and gets `null` |
| `frontend-react/src/deal/schedule.ts` | `recoveryReadonly` is a READOUT of `payload.duration`, never an input. An unset duration says `Contract duration not set` rather than showing a bare number |
| `frontend-react/src/deal/schedule.ts` | `single` is not `hybrid`, so the year schedule buckets `hardwareIn + hostingIn`. Hybrid buckets hosting only, because its hardware is milestone-driven and would double-count |
| `frontend-react/src/deal/payload.ts` | `effectiveStructure` returns `'single'` whenever `paymentMode === 'opex'`. **OPEX IS THE SINGLE-PHASE MODE**, which is what makes this ruling a relabelling rather than a repricing |

**THE CONSEQUENCE, AND IT IS THE POINT OF THIS SECTION.** Removing Single phase
from the rail removes it as an OPTION FOR NEW PRICING. It must never be removed
from the INTERPRETER, because **three issued versions carry
`inputs.structure = 'single'` frozen inside them** and the approval page prices
every one of them by feeding that snapshot back through
`calculateDeal(buildDealInputs(...))`. A derivation that stopped understanding
`single` would not fail loudly; it would fall to the `null` recovery branch and
quietly reprice an approved deal.

**So `structure === 'single'` in `deal-calculator.js` and `schedule.ts` is
LOAD-BEARING FOREVER, independently of whether any control can still produce
it.** That is the claim R-PT3's proof step exists to verify.

---

## PHASE 0, MEASURED BEFORE ANYTHING WAS WRITTEN

**The count re-verified**, over the whole population with coverage asserted
rather than assumed (18 of 18 live opportunities walked):

```
  8  capex / (none)        7  capex / twoPhase
  2  capex / single        1  capex / hybrid

ruled: TT-SGP-MANUFI-005, TT-SGP-SMARTC-003
found: TT-SGP-MANUFI-005, TT-SGP-SMARTC-003     UNCHANGED since the census
```

**Both carry `paymentMode` ABSENT rather than `'capex'`**, defaulting through
`String(payload.paymentMode ?? 'capex')`. So the migration WRITES the key for
the first time rather than changing it, which is worth knowing before a patch
is composed.

**Neither carries any `opexUnitFees` or `opexUnitMargins`.** That is what makes
the migration inert: the OPEX allocation in `deal-inputs.js` is guarded
`if (target === null) continue`, and with no fee and no margin override there is
no target, so the loop does nothing.

**"Same economics" is MEASURED, not inherited from the earlier round's
wording.** Every derived value compared, before and after `paymentMode: 'opex'`:

```
                                 MANUFI-005   SMARTC-003
paymentMode -> opex                 0 of 49      0 of 49
  ...and the comparator CAN see a difference:
targetMargin 30 -> 35              18           21
ssExisting +10                     31           30
duration +12                       14           19
warrantyPct 2 -> 9                 21           23
structure -> twoPhase               7            5
```

The 49 values include `totals.contractNet`, `totals.oneOffPrice`,
`achievedMargin`, `cashFlow.totRev` and every group's rows.

**THE FIRST RUN OF THAT COMPARISON WAS WORTHLESS AND IS RECORDED AS SUCH.**
`catalogToRates` returns `{ rates, missing, batches }`, not the flat map. The
probe passed the WRAPPER, so every rate lookup missed and `hardwareCost` was
**0 on both records**: the migration moved nothing because nothing was priced.
It was caught by the calibration reading `0 moved` for a five-point margin
change, which is the instrument refusing to be trusted. Same shape as the
approval-page zeros defect, reproduced inside this round's own probe.

**The issued versions, named before anything moves:**

```
TT-SGP-SMARTC-003  rev 38   V2.0/issued frozen structure=single
                            V1.0/issued frozen structure=twoPhase
TT-SGP-MANUFI-005  rev 12   V1.0/issued frozen structure=single
                            V0.1/draft  frozen structure=twoPhase
```

**Two issued versions carry `single`.** Those are the snapshots the proof step
opens.

---

## THE PROOF STEP FOUND SOMETHING THE RULING DID NOT ANTICIPATE

R-PT3 asks for the issued version's figures to be **"non-zero, matching a
direct derivation run over that snapshot"**. That is the right test and, on its
own, **it cannot detect the fault it exists to detect.**

Measured, by injecting the fault: `structure === 'single'` in
`deal-calculator.js` changed to a name nothing produces, which is exactly
"somebody removed the meaning along with the option".

```
FAIL single still recovers over the FULL TERM: recov null against duration 60
FAIL single still recovers over the FULL TERM: recov null against duration 36

the page MATCHES the direct derivation   ok, on both records
total cost matches                       ok, on both records
achieved margin matches                  ok, on both records
```

**THE MATCH SURVIVES THE FAULT, because the page and the "direct derivation"
are the SAME READER.** Both call `calculateDeal`. Break the calculator and both
move together, agreeing perfectly on a figure that has silently changed. That
is Verification 20 arriving inside a proof: two readers that cannot disagree
are one reader, and a comparison between them measures nothing.

**So the proof carries a SEMANTIC anchor as well as the match**: `single` still
reports `structure: 'single'`, and `recov` still equals the contract duration,
which is the one thing the calculator does with the value. That is the
assertion the injection fires on, and it is the only one that does.

**The figures being NON-ZERO is the ruling's own guard against the neighbouring
failure** and it is kept for that reason: two derivations that both collapse to
zero also agree perfectly, which this estate has shipped before.

---

## THE PHASES, RECONCILED BY COUNTING

Counted from the commits on this branch, not read off this file.

| Phase | Commit |
|---|---|
| The brief, John's rulings, and what `single` permanently means | `3c3742a` |
| R-PT3 rail and F5/F3 Option A: two radios, one render | `faa701d` |
| R-PT3 migrated, read back, interpreter proved | `5b1edfe` |
| The migrated record rendered, at both widths | `3813cec` |
| Close-out | this commit |
| `CURRENT_STATE.md` | the next |

**Rulings in force: 3** - R-PT3, F5/F3 Option A, and the standing
named-findings-only rule. All three were in this file before any work began,
so nothing had to be appended late (build discipline 7).

---

## DISPOSITION, ITEM BY ITEM

| | Disposition |
|---|---|
| **R-PT3, the screen** | **BUILT.** CAPEX offers Two-phase and Hybrid. Single phase is offered nowhere, in either mode |
| **R-PT3, the migration** | **DONE.** Two explicit revisions, reason recorded as the first note in each log, read back from the database, nothing else moved |
| **R-PT3, the proof** | **DONE, and it changed the test.** See the section above: the match alone cannot detect the fault, so the proof carries a semantic anchor |
| **R-PT3, `single` recorded** | **DONE**, permanently, above |
| **F3** | **BUILT.** One render in every structure and mode, asserted as an enumeration over all four combinations |
| **F5, Option A** | **BUILT.** Side by side, top-aligned, full card width, below the rail row, zero overflow |

**What this round does NOT establish.** The empty area beside the rail under
Hybrid is accepted per the ruling and is not a measurement of anything. And the
migration is proven inert for THESE TWO RECORDS on their current payloads; it
is not a general claim that OPEX and CAPEX-single price identically for any
deal, because a record carrying an OPEX fee or margin override would reprice.

---

## CARRIED, NOT BUILT

Recorded and queued rather than folded in, per the standing rule.

1. **`SwitchButton` writes `btn-ghost deal-toggle` itself**, so the gross-up
   control reaches the toggle treatment by a third route. F1 named the mode and
   factoring controls only. Carried from the previous round.
2. **A stored `capex` + `single` record would now show no active radio.** No
   live record is in that state after this migration, and no control can create
   one, so it is unreachable rather than latent. Deliberately NOT auto-mapped in
   `uiFromPayload`: that would be exactly the silent data rewrite the ruling
   forbids.
3. **Two dev servers are running**, one with `--watch` from 23 September that
   holds no port, and one without `--watch` on 3000. Measured, no `src/` file
   has changed since the latter started, so nothing this round measured was
   stale. Named because the estate has no detector for it.

---

## Standing method

- Measurements on the LIVE surface, never inferred from source.
- Layout claims stated as a RELATIONSHIP between two elements.
- Every screenshot opened and read.
- Every new guard calibrated both directions, and a SILENT injection explained.
- Database read-back after every write, from the database rather than from the
  writer's own report.
- Commits at every phase boundary. Nothing pushed.
