# Opportunity walk round (walk 6): the brief

Branch `opp-walk6`, off `main` at `7b149c9`, confirmed equal to `origin/main`
by `git ls-remote` against the real remote rather than the local tracking ref.

**The first check of this round failed and the round stopped**: `main` was ten
commits ahead of `origin/main`, walk 5 having been merged and not yet pushed.
Reported with both SHAs, and restarted once the push landed. Recorded because
a precondition that is checked and then worked around is not a precondition.

Rule 18 governs: **this round ends "ready for John's push"** and nothing is
pushed from the session.

---

## The findings, verbatim

> **N1:** the customer payment milestones (hardware) gain a TOTAL row, same
> shape as the hosting panel's: the USD column totalled, right-aligned, the %
> column totalling beside it as the installation grid already does. If the
> carried milestone two-readers defect (stored vs derived USD) makes the total
> ambiguous, STOP and report rather than totalling numbers that can disagree.
>
> **N2:** the installation panel stops spanning the row: the responsibility
> select sized to its longest option, the lump sum field sized to a 9-figure
> amount, the panel width collapsing to its content. Measure first, adopt the
> estate's grid pattern.
>
> **N3 (closes O1, John's feedback arrived):** the Opportunity's
> Summary/Notes/Follow-up band moves ABOVE the stats banner, rendering
> directly after the opportunity name. The band stays the same shared island;
> only its mount point moves. Record O1's closure in the brief.
>
> **N4:** the Test Bed's stats banner takes the same border treatment as the
> Opportunity's: one rule or one shared class, not a copied literal.

---

## O1 IS CLOSED

Walk 4 carried **O1** deferred, in John's words at the time:

> "the band's position below the chevrons is recorded, awaiting John's
> feedback"

**N3 is that feedback, and it closes O1.** The band moves above the stats
banner, directly after the opportunity name. O1 leaves the carried list.

---

## What each finding is

| | What it is | Disposition |
|---|---|---|
| **N1** | A total row, **with its own stop condition**. The carried two-readers defect is about this very column | **MEASURED FIRST.** If the two readings can disagree, the round reports rather than totals |
| **N2** | Layout and sizing, with "measure first" stated in the finding | Measure, then adopt the estate's grid pattern |
| **N3** | A mount point moves. The island itself is untouched | Build |
| **N4** | A shared treatment replacing a copied literal | Build, as ONE rule or ONE class |

---

## THE FLAG ON N1, RAISED BEFORE ANY WORK

N1 carries its own stop condition and **the carried defect it names is about
exactly this column**. Walk 5's Phase 0 recorded it:

> The grid's USD column derives from `pct x oneOffPrice`;
> `customerScheduleWarning` and `readMilestones` read the **stored** `usd`,
> which is only written back when a **pct is typed**. So changing the units
> after setting milestones leaves the screen showing one number and the save
> writing another. **Reasoned from source, NOT measured.**

**A total is a claim that the column adds up**, so it inherits whatever
disagreement the column carries. Two readings that differ would produce a
total that is right about one of them and wrong about the other, with nothing
on screen saying which.

**So the first work of this round is to MEASURE that disagreement**, not to
reason about it further. Walk 5 recorded it as unmeasured and that is still
true. The three possible answers lead to different rounds:

1. **The two readings cannot disagree** - the total is ordinary work.
2. **They can disagree and the fix is small** - the fix comes first, then the
   total sits on one reading.
3. **They can disagree and the fix is a round of its own** - N1 stops and
   reports, which is what the finding instructs.

---

## Standing method

- Measurements on the LIVE surface, never inferred from source, with the
  retired `#deal-form-vanilla`, `#deal-version-vanilla` and `#ref-vanilla`
  blocks excluded by name.
- Layout claims stated as a RELATIONSHIP between two elements, never as a CSS
  property, and asserted on the LEAVES rather than on a container: walk 5
  recorded that a container cannot report its own children wrapping.
- Every screenshot opened and read, with the element proven to be inside the
  captured region AND visible: `.is-loading > *` hides children while
  preserving layout, so geometry reads healthy on a blank picture.
- Every new guard calibrated both directions, and a SILENT injection explained
  rather than ignored. Walk 5 found a tautological assertion and a duplicated
  server rule that way.
- CSS comment edits followed by a PAIRING WALK, not a delimiter count: walk 5
  broke the same block twice and a count called the file balanced both times.
- Commits at every phase boundary. Nothing pushed.

---

## Exit gate

| Point | Answered at the close |
|---|---|
| Every finding built, stopped or recorded | **Yes.** N1 stopped, then ruled and built as R-N1 + N1. N2, N3, N4 built |
| N1's stop condition measured rather than assumed | **Yes.** Driven at 40 then 80 units: displayed 467,143 against stored 233,571.50, a 100% disagreement, saved with no indication |
| Every new guard calibrated both directions | **Yes.** 10/10 on N2/N3/N4, every injection firing on its NAMED check; N1's and the contractor grid's calibrated in their own phase |
| Live proof at 1440 and 1240 | **Yes.** 11/11 installation panel, 20/20 band and banners, both widths |
| Screenshots opened and read | **Yes**, and three of them changed the work: the N2 note overflow, the `max-content` blow-out and the label collision |
| Database read-back where a write is involved | **Yes.** The milestone payload read back from the record after every save |
| Fixtures torn down, re-queried | **Yes.** 132 of 132 live records walked, zero created in the last three hours, three owners all real accounts |
| O1's closure recorded | **Yes**, in this brief and at the band's own markup |
| `CURRENT_STATE.md` regenerated and reconciled | see the close-out |
| Full gate with `--round-close`, branch and merged | see the close-out |
| Merged or pushed | **No push from the session** |

---

## WHAT THIS ROUND FOUND IN ITS OWN WORK

Recorded because the calibration found each of them and reading the probe did
not.

1. **The `1fr 1fr` injection came back SILENT with the whole probe green.**
   `#deal-installResp` carries its own width, so reverting the grid template
   reverted the COLUMNS and left the CONTROLS their size. Every check was a
   property of a control; the dead space N2 is about opens BETWEEN them. The
   replacement asserts the two controls sit 16px apart, and the injection puts
   them 128px apart.
2. **The first replacement for it was also wrong.** It asserted the row leaves
   a quarter of itself unclaimed, which the explanatory note legitimately
   fills. N2 does not ask the note to be narrow.
3. **N2's own `max-content` overflowed the section by 64px at 1240**, because
   the second column sized to that 320px note. Mine, so it is part of the
   change rather than a carried finding: fixed with `minmax(0, max-content)`.
   **The overflow is offscreen and no screenshot of the section can show it.**
4. **An "empty chevron strip" was my instrument, not a defect.** The Test Bed's
   chevron is async and the stats banner is not, so a wait on the banner is
   satisfied before the chevron paints: 0 children at the shutter and 8 a
   moment later. It was about to be recorded as a finding.

---

## CARRIED, NOT BUILT

Everything below was walked past rather than caused, so it goes on the list
rather than into this round.

1. An empty contractor schedule displays **`TOTAL 100% $0`**, because
   `scheduleReconciliation` returns `exact: true` with no rows.
2. At 1240 the Test Bed chevron clips **`DECOMMISSIONING`** to
   `)ECOMMISSIONING` against its own clip-path.
3. At 1240 the PO factoring toggle clips **`FACTORING DISABLED`**.
4. `#ref-vanilla`'s eleven ids; `ref-save-feedback`'s dual naming; the orphaned
   `.tab-action-idle` rule; `input.input-invalid` with no applier.
5. The project-milestone vocabulary table as a future configuration item.
6. Walk 5's WHT placeholder wording: WHT reads `--` where GST reads
   `not recorded`.
