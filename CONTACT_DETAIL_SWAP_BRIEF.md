# R1 - Contact detail surface swap: brief

Governing docs: `CLAUDE.md`, the `tms-round-method` skill,
`INTERACTION_STANDARDS.md`. The conformance gate applies. Drafted from
Round B's measured Phase 0 and Phase 1 reports plus
`RECORD_SURFACE_CONSOLIDATION_CLOSE_OUT.md`; **re-verify every premise
against the tree you are on.** This brief's R-series is its own.

Opened on `f790f1a`, the tree ENFORCEMENT GAPS closed and published. The
gate's racing invariants, `pagedSelect` timeout and enforcement gaps are
fixed, so **a green gate now means green** - which is the precondition this
round needed and did not have.

## The scale principle applies

`DESIGN_PRINCIPLES.md` §4: an internal tool, a small team of up to five,
worst case around five simultaneous operations. **Verification is
proportionate.** No load paranoia about contention the product cannot
produce, and no test may assert one.

---

## Rulings of record (John, 2026-09-14)

- **R1.** The Contacts list row-click opens the **SHARED record surface**
  (the leads surface plus Round B's account section), not the bespoke
  `contact-detail` screen. **Same surface for lead and contact, one record
  view, the standard enforced.**
- **R2.** The shared surface becomes the contact detail view in **view/edit
  mode**: it renders cleanly for a complete record, with **no "please
  complete" framing when nothing is missing**.
- **R3.** The account section built in Round B **shows for contacts**.
- **R4.** **Create-Test-Bed and Create-Opportunity STAY on the Contacts
  list this round.** They are not pulled into the surface.
- **R5.** The bespoke contact-detail screen **RETIRES** once the shared
  surface serves contacts. **Keep the view id and route** (Round B's
  measured recommendation), so the retirement is of **`ContactHost` and
  `ContactPanel`**, not of the view.
- **R6.** **The 15 tests are re-pointed AGAINST THE REQUIREMENT, never
  against the rewrite.** This is the round's **named job**, not a tail. A
  test written after the swap to match the swap is the proxy fault, and
  this round exists because Round B refused to do it in a rush.
- **R7.** Method unchanged: phases stop for sign-off, findings named before
  fixed, data changes proposed before applied, final-act gate on the exact
  committed tree, the word follows the stated gate result, **nothing pushes
  without it**.

### Why this is its own round

Round B **built R1, measured it, and reverted it.** It works. It was not
shipped because shipping it would have left the bespoke screen's tests
addressing markup that no longer renders - **the only automated protection
the contact screen's behaviours have** - and re-pointing them inside the
same change that rewrites the screen is Verification 47 exactly.

> On a screen serving **10 live Qualified contacts**, with the walk still
> pending, the rewrite and its protection are not done in one motion.

---

## Phase 0 - MEASURE

Round B measured much of this. **Re-confirm against the current tree; do
not re-measure wholesale.** A premise that has moved is a finding and is
reported as one.

1. **The retirement inventory.** Everything pointing at `contact-detail`:
   routing, links, the view id, probes, gate stages, tests. **Enumerate the
   tests that assert the bespoke screen's behaviour**, with what each
   asserts - the save path **including the change-note audit trail** Round
   B found, the qualification tinting, the industry lookup, the revision
   handshake.
2. **P2 FOLDS IN.** The 13 attribute-vs-visibility detectors, nine of them
   gate stages, are the family that has already shipped a defect. **Which
   of the contact tests are in that family, and what is the correct
   assertion** (Verification 4: assert the computed visibility or the
   relationship, never the attribute) - **so re-pointing FIXES them rather
   than carrying the fault forward.**
3. **View/edit mode.** Does the shared surface render cleanly for a
   complete record today, or is that a build? Answer with the component,
   not with the prop list.
4. **The three-consumer frozen constraint.** Confirm which consumers
   dissolve when `ContactHost` retires, and which do not.

**Deliverable:** the re-pointing plan, per test, derived from the
requirement. Stop for sign-off.

## Phase 1 - THE SWAP

- Swap the Contacts list row-click to the shared surface.
- **Preserve every capability the bespoke screen had**, the save path
  **including the change-note audit trail** first among them. Round B
  measured that the naive swap deletes it silently and **no test on the
  replacement could have noticed, because the replacement never had the
  behaviour to lose** (Verification 49's save-path clause).
- **Re-point the tests against the requirement** (R6).
- Retire `ContactHost` and `ContactPanel`, keeping the view id (R5).

**Prove:**

| claim | instrument |
|---|---|
| a contact renders correctly on the shared surface, with the account section | **live DOM + screenshot**, three widths |
| the audit trail still writes | a live save, the note read back |
| the door, both ways | owned and non-owned |
| the retirement strands nothing | every contact reachable, every pointer updated |
| the P2 detectors now assert visibility correctly | injection, both directions |

Stop for sign-off.

## After Phase 1

**John walks a contact on the shared surface.** That is the load-bearing
parity check that the swap preserved everything, and it is the backstop
this estate has measured across three rounds as the one the rules do not
replace.
