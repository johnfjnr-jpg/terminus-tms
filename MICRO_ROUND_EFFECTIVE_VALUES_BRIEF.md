# Micro-round: effective values, the blank-control class

Branch `dealsheet-3`, off `main` at `e6a3499`, confirmed equal to
`origin/main` by `git ls-remote` against the real remote.

Rule 18 and build discipline 19 govern: **this round ends "ready for John's
push"** and nothing is pushed from the session. No Superpowers skill is
active in this session; no worktrees, no finish-branch or PR workflow.

---

## The instruction, verbatim

> **THE DEFECT CLASS:** an edit control renders EMPTY while the value it
> represents exists (stored on the record, or derived by the single
> derivation). John's screenshot shows the C2 hardware drawer's Margin % and
> Price boxes blank beside a computed $529,999 total; he reports OTHER fields
> like this exist estate-wide.
>
> **STEP 1, CENSUS BEFORE FIX:** walk every editable control on the live
> surface (deal sheet drawers, Commercials panels, Reference tab, Test Bed,
> contacts, leads) on a populated record at both widths, and list every
> control whose box is empty while its effective value is non-empty.
> Distinguish and PRESERVE the legitimate case. Report the census table
> (control, surface, effective value, what the box shows) BEFORE building.
>
> **STEP 2, ONE MECHANISM:** name why each blank happens. Fix through a shared
> display-value resolver, not per-control patches: a control displays the
> effective value it represents; a typed value replaces and stores per its own
> semantics; clearing returns to the derived display, never to blank. Where a
> site's blank has a DIFFERENT mechanism, fix at that mechanism and say so.
>
> Red-first guard estate-wide: no editable control renders empty while its
> effective value is non-empty, calibrated by blanking one site's fallback;
> live proof at 1440 AND 1240, screenshots opened and read including the
> drawer from John's screenshot repopulated; DB read-back proving a typed
> override stores and a cleared one removes without residue. Close-out,
> CURRENT_STATE, branch gate --round-close, merge --no-ff, merged-tree gate,
> "ready for John's push". Any red: STOP. Reports per M6.

---

## Step 1 is a STOP, and the reason is a prior ruling

The census found two families. One is the defect as described. **The other is
a decision an earlier round took deliberately, and this round's instruction
contradicts it.** That is Verification 23 - two correct decisions about the
same question taken in different rounds - and the rule is that the conflict is
reported rather than resolved quietly.

The census, its calibration and the conflict are in
`STEP1_CENSUS_REPORT.md`.

---

## The rulings on the Step 1 stop, John, 2026-09-24, verbatim

Appended at the phase they launch, per build discipline 7, rather than
discovered at the close.

> **R-EV1, FAMILY A BUILDS:** the 14 statement drawer controls display the
> EFFECTIVE value each represents (the margin from its resolver, the price/fee
> from the single derivation) via a fallback to the derivation at the one
> mechanism (`DealStatement.tsx:74`'s `?? ''`), not per-control. A typed value
> replaces and stores per C2 semantics; clearing returns to the derived
> display, never blank.
>
> **R-EV2 (amended by John):** NO added text or marker. A control whose line
> carries a STORED override renders its value in BOLD and the `--attention`
> amber token; a line following the derivation renders normal weight and
> colour. Both signals together because colour must not carry meaning alone
> (estate accessibility reference). The style appears when an override stores,
> disappears when cleared: guarded both directions. Contrast of the amber value
> on its surface measured >= 4.5:1 per the walk-12 standard.
>
> **R-EV3, FAMILY B UNTOUCHED except the placeholder lie:** each old-card margin
> box's placeholder states its OWN line's effective margin (warranty shows 0,
> hoAqm 29.9), so B8/B9's "blank prices at target" promise reads true per line.
> No semantic change; retirement stays C3's decision. Record B8/B9 as
> amended-not-superseded in the brief.
>
> Then: the estate-wide red-first guard (no editable control empty while its
> effective value is non-empty, family B's deliberate blanks EXEMPTED by name
> with B8/B9 cited), calibration both directions, live proof at 1440 AND 1240
> with the drawer from John's screenshot repopulated, an overridden line and a
> cleared line both photographed, screenshots opened and read, DB read-back
> proving a typed override stores and a cleared one removes. Close-out,
> CURRENT_STATE, branch gate `--round-close`, merge `--no-ff` (ls-remote
> `e6a3499` at the moment of merge), merged-tree gate, "ready for John's push".
> Any red: STOP. Reports per M6.

---

## B8/B9 IS AMENDED, NOT SUPERSEDED

Recorded here because Verification 23's remedy is deletion rather than
reconciliation, and this ruling is neither: it leaves the decision standing and
corrects a statement the decision makes.

**B8/B9 stands.** A blank old-card margin box still means "this line is not a
decision, it follows the derivation", and blank remains the way that is said.
The distinction between a line following target and a line somebody set to
target survives, which is the thing a fill would have destroyed.

**What is corrected is the promise the placeholder makes.** It read
`String(target)` on every row, so it said `30` on a warranty line that prices at
`0.0%` and on a hosting line that prices at `29.9%`. The placeholder is the only
thing on that card telling a reader what blank will do, and on two rows it was
telling them something false.

**So the semantics are untouched and the statement of them is made true per
line.** The retirement of these cards remains C3's decision and this round does
not touch it.

**R-EV2's reading, stated because the sentence admits two.** "A control whose
line carries a STORED override" is taken as the CONTROL's own state, not the
row's, because the following sentence contrasts it with "a line following the
derivation". Under the either-or, a line carrying a price override shows its
margin as text rather than as an editor, so the only editor left on that line is
the one holding the stored value. A price box rendering a derived price beside a
stored margin is FOLLOWING the derivation and renders normal.
