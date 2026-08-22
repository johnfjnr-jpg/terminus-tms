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

---

## Round 19 outcome

A documentation round. Four phases, 0 through 3, no migration, no code, no
configuration change.

### Rule 7 had nothing to grep, and that is a finding

`grep -n "^## Phase\|^### Phase"` against this brief returns **0**, with the
`###` half of the pattern included as build discipline rule 7 requires. The
same pattern returns 5 against `ROUND18A_FIX_BRIEF.md`, so the zero is a real
absence rather than a broken pattern.

**This brief carries its phase list as a markdown table, at lines 178 to 181,
not as headings.** Rule 7 counts headings, so against a brief shaped this way
it counts nothing and reports a clean zero. That is the Round 10A situation
restated: a check that cannot see its subject returns the same value as a
check that saw nothing wrong.

The wider `grep -n "^#\+ .*Phase"` returns 1, the document title, which is a
single-hash heading the rule's own pattern is written to skip.

**Not resolved here.** The candidate resolutions are to require phase
headings in every brief, or to widen rule 7 to count a phase table as well.
Both are decisions about the standing rule rather than about this round.

Counted from the table, the four phases are 0, 1, 2 and 3, and each carries
an explicit sign-off in the session transcript: "Phase 0 report reviewed and
signed off, with four corrections", "Phase 1 signed off", "Phase 2 signed
off, and the Amendment 4 merge is adopted", "Phase 3 signed off, with two
amendments before close-out". This report does not sign off its own phase.

Six commits at phase boundaries. The brief was committed before any target
file was touched.

### What each phase did

**0.** Five investigations, no edits. I1 answered the staff storage question
against the database. I2 confirmed all six anchors unique. I3 confirmed
`CURRENT_STATE.md` not stale on both halves of its own test. I4 confirmed
four of five configured-state expectations and found the fifth wrongly
worded. I5 confirmed Finding 6 needed replacing. Two corrections then landed
in the amendment files: the em dash criterion, and the anchor-check command.

**1.** Amendments 1, 2 and 3. `CLAUDE.md` read list gains
`OPPORTUNITY_DESIGN.md`. `DESIGN_PRINCIPLES.md` Section 5 gains a
partially-superseded banner naming the three statements that still govern.
Section 6 is reframed from stale documentation to a control gap.

**2.** Amendments 4 revised and 5, both landed as an answered finding rather
than as the open question they were drafted around. `PROTOTYPE_SPECIFICATION.md`
Section 3's two false statements are marked superseded with the original
reasoning left standing, and it keeps its green marker.

**3.** `OPPORTUNITY_DESIGN.md` Finding 6 replaced, open decisions 9 to 10, and
the status legend restated as three markers with four states.

### The staff field question, answered

The payload holds a name as text, not a reference to a `terminus_staff` row.
Zero UUIDs and 48 name strings across 1,388 readings, every string an exact
match for a `terminus_staff.name`. Three independent lines agree and none
dissents: the stored values, the write path building every option value from
`s.name`, and a comment in `opportunities.js` that already said so.

**All three live Opportunity records hold these keys absent from the payload
entirely**, so a query against live Opportunities alone compares nothing to
nothing and returns something shaped exactly like the answer. The reading came
from soft-deleted Opportunities and live Test Beds instead.

Two things the query surfaced without being asked. There is **no server-side
validation**, so the controlled list is a client-side affordance and any
string can be written to `lead` through the ordinary PATCH path. And the
directory feeds **three record types, not the two every document described**:
`Account` carries its own `terminusLead`.

One record of one finding, in `DESIGN_PRINCIPLES.md` under Deferred scope,
dated 2026-08-22. The earlier plan split it across two entries in the same
file and that was dropped: two records of one thing drift apart.

### `CLAUDE.md` changed in phases 1 and 3

**The next session must re-read it from disk.** The copy delivered at session
start is a snapshot taken then, so a session following a round that edited it
receives the old version.

- **Phase 1**: the read-list table gains `OPPORTUNITY_DESIGN.md`.
- **Phase 3**: **Verification 17** promoted, on a probe that distinguishes two
  states needing to be shown returning a different value in each. Two
  instances from this round support it, both searches that ran perfectly
  against the wrong thing. A third candidate was cut on review because it was
  a search that did not run, which is rule 12's case, and keeping it would
  have undercut the boundary between 17 and 12.

### The 28 em dashes in `PROTOTYPE_SPECIFICATION.md`

Pre-existing, in section headings including Section 3's own. **Deferred, not
this round's work.** Both amendment files originally asserted a count of zero
before and after for every file, which could never have passed on the one
file Amendment 5 edits. Restated as unchanged at 28 there, zero in every other
file, and no em dash in introduced text. Each amendment file also held one em
dash of its own, inside that criterion. Both removed.

### Record counts fall outside the `CURRENT_STATE.md` staleness test

The test reads `supabase/migrations`, `supabase/seeds` and `src/routes`. Record
counts are read from the live database and change without any of those
changing, so a divergence between the generated file and the database would
pass the staleness test silently.

**Named as a coverage gap. No instance was observed this round**: the
Opportunity counts were re-queried directly and the database and
`CURRENT_STATE.md` agree exactly, 3 live and 60 soft deleted, Discovery 58,
Negotiation 1, Proposal 1.

### New finding: the two-page constraint has been false for many rounds

`CLAUDE.md` opens by stating about itself that it is deliberately short, that
it carries rules rather than reasoning, and that **"if this file grows past
roughly two pages it stops being read properly and stops working."** The file
is **523 lines** at the close of this round, and was 485 at the start of it.
Two pages is on the order of 120 lines.

**The constraint has been silently false for many rounds, and every promotion
decision taken since has been taken against a ceiling already breached.**
Including this round's own, which was argued on its merits and against a limit
nobody could have been applying.

**Same shape as the staleness test this file documents about itself.** That
rule read "a copy whose SHA is not current HEAD is stale", which could never
pass, and Round 9 recorded that a rule which always fails is worked around
rather than followed. This is the same failure in the other direction: a rule
that is never checked is not followed either, and a stated limit that is
routinely exceeded stops being a limit and becomes decoration.

**Not a fix for this round. The resolution is a decision**, and there are two
honest options. Restate the constraint as something true, which means naming
the real length at which the file stops being read and measuring against it.
Or restructure the file so it can hold what it now carries, which probably
means separating the rules from the evidence that justifies them, since most
of the growth is worked examples rather than rules.

### Reconciliation

`CURRENT_STATE.md` was **not regenerated, deliberately**. It is generated at
round close when configuration changed, and **this round changed no
configuration**: no migration, no seed, no route, no database write. Its
checksum is unchanged from the start of the round, and its own staleness test
passes on both halves, with `dd7459a` an ancestor of `HEAD` and no tracked
configuration source touched since. Regenerating it would have produced a diff
consisting only of a new timestamp and commit SHA, which is churn rather than
a changelog.

Files changed: `CLAUDE.md`, `DESIGN_PRINCIPLES.md`, `PROTOTYPE_SPECIFICATION.md`,
`OPPORTUNITY_DESIGN.md`, and both amendment files. Every one is documentation.

Em dashes at close: 0 in `CLAUDE.md`, `DESIGN_PRINCIPLES.md`,
`OPPORTUNITY_DESIGN.md`, `CURRENT_STATE.md` and both amendment files, and 28
in `PROTOTYPE_SPECIFICATION.md`, unchanged. Heading lists byte-identical in
every file except `OPPORTUNITY_DESIGN.md`, where exactly one heading changed,
Finding 6's own title.
