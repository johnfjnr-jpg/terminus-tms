# Opportunity documentation round: Phase 0, investigation and plan

**Round number to be confirmed by the repo owner.** The last recorded round
is 18A. This brief assumes the next number but does not depend on it.

---

## What this phase is

**Investigation and a plan. No file edits, no migrations, no code, no
configuration changes.**

Phase 0 produces two things: answers to the investigations below, and a
phase plan for the documentation changes. The plan is reviewed and signed
off before any file is touched.

**Do not begin the Opportunity stage restructure.** Nine decisions in
`OPPORTUNITY_DESIGN.md` are open and at least three of them block that
work. This round is documentation only.

---

## Read first

| Document | Why |
|---|---|
| `CLAUDE.md` | Standing instructions. Note that the copy injected at session start may be stale; read it from disk |
| `OPPORTUNITY_DESIGN.md` | New in this change, v1.1. The authority on what Opportunities is meant to become |
| `DOC_AMENDMENTS_2026-08-22.md` | Amendments 1, 2 and 3 |
| `DOC_AMENDMENTS_2026-08-22_revB.md` | Amendments 4 (revised) and 5. **Supersedes Amendment 4 in the file above** |
| `DESIGN_PRINCIPLES.md` | Sections 5 and 6, and the Deferred scope entry beginning "Terminus staff directory, 2026-08-16" |
| `PROTOTYPE_SPECIFICATION.md` | Section 3 |
| `CURRENT_STATE.md` | Generated. Confirm its own staleness test before relying on it |

---

## Standing rules that bear directly on this phase

Named explicitly because each has a live trap in the work below.

- **Rule 16.** Capture every run to a file, then grep the file. Never pipe a
  run whose result is not yet known through a filter.
- **Verification 12.** A search returning nothing means the thing is absent
  OR the search did not run. Before reporting an absence, confirm the search
  can find something you already know is present in that same file.
- **Verification 14.** A check that passes when both sides are absent is not
  a check. Compare presence first, then value.
- **Build discipline 2.** Confirmed is not verified. A claim is complete when
  checked against real evidence: a database query, a browser test, or
  server-side confirmation. Not inspection, not reasoning about what the code
  should do.
- **Rule 9.** Create the round branch before Phase 1 begins and commit at
  every phase boundary. Phase 0 ships no diff and still commits, carrying
  this brief.

---

## Investigations

Each one states what counts as evidence. Report the finding whether or not
it is the expected answer.

### I1. The staff field storage question. This is the only one that needs the database

**The question.** When a user selects a name from the Terminus Lead or
Authority dropdown, does the payload store a reference to a `terminus_staff`
row, or the name as text?

**Why it matters.** The Opportunity model puts Sales Lead approvals at three
stages and a Bid Review approval at the gate into Proposal. If the field
holds a name string, approval routing can never key off it, and
`routing_rules` has held zero rows since Milestone 2.

**Method.**

1. Dump the schema of `terminus_staff`: every column, and any foreign key
   referencing it from any table.
2. Read the payload of a live Opportunity record and report the raw value of
   `lead`. Do the same for `terminusLead` on a live Test Bed.

**The trap, and it is Verification 14.** There are only 3 live Opportunity
records, all in Discovery. **They may all hold null.** Null on both sides
proves nothing and must not be reported as "not a UUID." If every live
record is null:

- Check soft-deleted Opportunity records, which are numerous.
- If still nothing, set the field deliberately through the real UI on a
  fixture record, then read the stored value back from the database. **Not
  from the browser.** The browser shows what was selected, not what was
  stored.

**State the counterfactual before running it.** What would the output look
like if the field held a reference, and what would it look like if it held
a name? Confirm those differ before treating the result as evidence.

**Do not infer the answer from the field names.** The reasoning that
`account_id` and `industry_id` carry `_id` while `lead` does not is
suggestive and is not evidence. `DESIGN_PRINCIPLES.md` already records one
plausible reconstruction that turned out to be false and was kept visible as
a warning.

### I2. Anchor uniqueness for all six amendment anchors

Every amendment matches on exact anchor text. Before any of them is applied,
confirm each anchor appears **exactly once** in its target file.

| Amendment | File | Anchor first line |
|---|---|---|
| 1 | `CLAUDE.md` | The `CURRENT_STATE.md` row of the read-list table |
| 2 | `DESIGN_PRINCIPLES.md` | `## 5. Sales opportunity stage gates in detail` |
| 3 | `DESIGN_PRINCIPLES.md` | `## 6. Opportunity value estimation, before a Deal Sheet exists` |
| 4 revised | `DESIGN_PRINCIPLES.md` | The first bullet under `## Deferred scope` |
| 5, anchor 1 | `PROTOTYPE_SPECIFICATION.md` | `Lead/Contact/Account model. There is no staff directory record type` |
| 5, anchor 2 | `PROTOTYPE_SPECIFICATION.md` | `built for Contact-to-Account linking, not a new one.` |

Use `grep -a`. **Per Verification 12, first confirm the search can find a
string you already know is in that file**, then search for the anchor. A
count of zero from a search never shown to reach one is not a measurement.

Report the count for each. Do not adjust an anchor to make it match. If an
anchor is absent or duplicated, that is a finding and the amendment stops
until it is resolved.

### I3. `CURRENT_STATE.md` staleness

Run its own two-part test, recorded in `CLAUDE.md`:

    git merge-base --is-ancestor dd7459a94c40c045857e43c96c0acb3d799c29b8 HEAD
    git diff --name-only dd7459a94c40c045857e43c96c0acb3d799c29b8..HEAD -- \
      supabase/migrations supabase/seeds src/routes

Report both results. **A changed source is not automatically staleness**: the
generator parses from disk. If the second half fails, regenerate and diff
rather than assuming the file is wrong.

Everything in `OPPORTUNITY_DESIGN.md`'s findings section was taken against
that commit. If the file is stale, the findings need re-checking before the
next round, not before this one.

### I4. Confirm the four configured-state findings still hold

These drive the next round's shape, so confirm rather than assume.

1. `stage_definitions` for `record_type = 'opportunity'`: report every row.
   Expected: 6 rows, Discovery / Qualified / Proposal / Evaluation /
   Negotiation / Closing, with no `Closed Won` and no `Closed Lost`.
2. `stage_gate_rules` for `record_type = 'opportunity'`: expected 0.
3. Live and soft-deleted Opportunity records by status value. Expected 3
   live in Discovery, and soft-deleted rows carrying old stage names.
4. `routing_rules` row count. Expected 0.
5. `approval_tracks`: confirm there is no Sales Lead or Bid Review track.

Report actuals against each expectation. **A mismatch is a finding**, and it
is more interesting than a match.

### I5. Read `OPPORTUNITY_DESIGN.md` Finding 6 and confirm it needs replacing

`OPPORTUNITY_DESIGN.md` v1.1 was written before the staff directory entry in
`DESIGN_PRINCIPLES.md` was found. Its Finding 6 states that
`PROTOTYPE_SPECIFICATION.md` and `CURRENT_STATE.md` "cannot both be
current," which overstates the position. The replacement text is in the plan
section below.

Confirm the section is present and reads as described before planning its
replacement.

---

## The plan to produce

A phase plan for applying the documentation changes. Small phases, each with
its own verification, each committing.

Suggested shape, to be argued with rather than followed:

| Phase | Content |
|---|---|
| 0 | This investigation. Report and plan. Commits the brief only |
| 1 | Amendments 1, 2 and 3 |
| 2 | Amendments 4 revised and 5 |
| 3 | `OPPORTUNITY_DESIGN.md` Finding 6 replacement, and any correction arising from I1 |

**Argue with the shape if the investigation suggests a better one.** In
particular, if I1 returns a definite answer, phases 2 and 3 may merge,
because both notes about the open question would be replaced by the answer
in the same change.

### The Finding 6 replacement text

Replace the whole of Finding 6 in `OPPORTUNITY_DESIGN.md` with:

    ### Finding 6. Staff directory: exists, but what the fields store is unknown

    **FINDING, NARROWED 2026-08-22. One query settles it.**

    A staff directory exists. `DESIGN_PRINCIPLES.md` records it under
    Deferred scope, dated 2026-08-16: `terminus_staff`, a small reference
    table holding name and title, seeded with the seven real staff names by
    migration, `GET`-only, no admin UI. The four Authority fields on
    Opportunity and Test Bed were converted from free text to dropdowns in
    the same change. `PROTOTYPE_SPECIFICATION.md` Section 3 still describes
    the pre-2026-08-16 position and is corrected separately.

    **What is unknown is whether the payload stores a reference to a staff
    row or the name as text.** The dropdown constrains entry either way. The
    difference decides whether approval routing can ever key off these
    fields, which matters because the model below puts Sales Lead approvals
    at three stages and Bid Review at the gate into Proposal, and
    `routing_rules` holds zero rows.

    **Score attribution is not affected.** A score entry's author is written
    server-side from the authenticated session and never accepted from the
    client, settled in Round 11. Who recorded a score and who is named as
    Sales Lead on the record are two different attributions, and only the
    second is in question.

---

## Explicit non-goals for this round

Do not do any of these, and do not plan them.

- The Opportunity stage restructure, or any migration.
- Creating `Closed Won`, `Closed Lost`, `is_terminal` or
  `reachable_from_any_stage`. Recommended, undecided.
- Creating a `Bid Review` or `Sales Lead` approval track. Undecided.
- Any change to `stage_probability_defaults`. Undecided.
- Any scoring criteria, anchors or scaffold rows. The instrument shape is
  undecided and is the next business conversation.
- Regenerating `CURRENT_STATE.md`. It is generated at round close, and this
  round changes no configuration.
- Editing `PROTOTYPE_SPECIFICATION.md` beyond the two anchors in Amendment 5.
- Resolving I1 by inference if the query is inconclusive. An honest
  "inconclusive, and here is why" is the correct output.

---

## Output format

Report, in this order:

1. **I1 through I5, each with the actual command run, the actual output, and
   the finding.** Where an expectation was stated, say whether it held.
2. **Any disagreement found between a generated file and a hand-written
   one**, reported and not resolved.
3. **The phase plan**, with the argument for any departure from the
   suggested shape.
4. **Anything in the amendments that looks wrong.** These were drafted
   without repository access, from uploaded copies of five markdown files.
   If an amendment misreads the repo, say so. That is a more useful output
   than a clean application.

Then stop and wait for sign-off.

---

## One note about `CLAUDE.md`

Amendment 1 edits `CLAUDE.md`. **The copy injected into a session is a
snapshot taken at session start**, so the session that applies Amendment 1
holds the pre-edit version, and the next session receives the old one unless
it re-reads from disk. `CLAUDE.md` records this about itself.

When this round closes, note in the close-out that `CLAUDE.md` changed, so
the following session re-reads it rather than trusting what it was given.
