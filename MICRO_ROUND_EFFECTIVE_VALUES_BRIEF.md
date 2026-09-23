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
