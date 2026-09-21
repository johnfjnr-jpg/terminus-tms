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

| Point | To answer at the close |
|---|---|
| Every finding built, stopped or recorded | |
| N1's stop condition measured rather than assumed | |
| Every new guard calibrated both directions | |
| Live proof at 1440 and 1240 | |
| Screenshots opened and read | |
| Database read-back where a write is involved | |
| Fixtures torn down, re-queried | |
| O1's closure recorded | |
| `CURRENT_STATE.md` regenerated and reconciled | |
| Full gate with `--round-close`, branch and merged | |
| Merged or pushed | **No push from the session** |
