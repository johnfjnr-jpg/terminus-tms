# Test Bed header and cost carry-forward: close-out

Gate: **22/22 PASS on `dff123c`**, clean tree, door stage PASS not SKIP.

**CLOSED 2026-09-10 on John's word.** W2 ruled answered, the 25-record sweep
approved and executed, and the round pushed to `origin/main`. The carried list
in section 9 is John's, in his order, and its first item is the next brief's
first opening act.

---

## 1. W2, cost carry-forward: ANSWERED AT THE CLOSE

**RULED BY JOHN, 2026-09-10: W2 is CONFIRMED AS BUILT.** One snapshot number -
`accumulated_cost` into `test_bed_cost` at conversion, feeding TCV - is the
**design of record**. No live link, no line items.

> If a future requirement wants the figure to track post-conversion cost
> changes, that is a NEW DESIGN ITEM, not a defect in this one.

That last clause is the load-bearing half and is why it is quoted rather than
summarised: a snapshot that does not follow its source looks like a bug to
anybody who meets it without this ruling.

**Nothing is carried from W2.** The section below is left standing as the
record of what was measured and asked, because the ruling answers it rather
than superseding it.

### The measurement the ruling rests on

Phase 0 measured that **the mechanism already exists**. `test-beds.js:1536`
passes `bedPayload.accumulated_cost` into `p_test_bed_cost` on create-from, and
six live bed/opportunity pairs agree exactly, with the value feeding TCV.

Phase 0 therefore asked one question rather than proposing a design, as the
brief instructed:

> **Is the existing single-number carry-forward what you meant?** If yes, W2 is
> closed by measurement. If not, the options are in section 5 and the shape is
> yours.

**That question was not answered.** Of the five decisions Phase 0 asked for,
four were ruled and one was not:

| # | Decision | Ruling |
|---|---|---|
| 1 | `accumulated_cost` or `indicativeCost` | **R4** accumulated cost |
| 2 | HM cell with no data | **R12** suppressed unless `hemirSensors` carries data |
| 3 | SS/AQ/HM labels or names above numbers | **R3** names above numbers |
| 4 | **W2: is the single number what you meant?** | **RULED at the close: yes, snapshot is the design** |
| 5 | Door sweep on the Test Bed view | **R11** yes, in scope |

**Answered: yes.** W2 is closed by the measurement already taken.

---

## 2. PROPOSED DATA CHANGE, not applied

**25 live opportunities left by the door probe.** Named `readonly-approver
Opportunity`, owned by the track-approver account, sitting in the business's
own list views since 2026-09-02. Enumerated structurally from the database by
what the fixture IS, never from a file a harness wrote (Verification 11).

Soft delete only, `reference_number_counters` untouched, ids before, per-id
result, residue re-queried after and expected to read zero.

| id | created | reference |
|---|---|---|
| `2ba2e36d-9fc3-4056-87b4-a2bd076daf23` | 2026-09-02 | TT-SGP-AIRPRT-759 |
| `1e435070-a7ef-4c05-b949-0043cc39c4a7` | 2026-09-02 | TT-SGP-AIRPRT-761 |
| `b55afe85-ede8-434c-a9ea-2fdcc1b0945a` | 2026-09-02 | TT-SGP-AIRPRT-763 |
| `07b2f996-1e93-4687-87c5-7097031e4518` | 2026-09-02 | TT-SGP-AIRPRT-765 |
| `07aa4d78-5caf-4729-aaa3-de2008c2af2b` | 2026-09-04 | TT-SGP-AIRPRT-1139 |
| `76ee6023-1c4f-4049-8f11-a4f6e1e3c793` | 2026-09-04 | TT-SGP-AIRPRT-1167 |
| `cd738fe4-4330-4698-b5da-709340f10531` | 2026-09-08 | TT-SGP-AIRPRT-3954 |
| `d55cccd6-6570-45b5-856d-7e9f23ede4c9` | 2026-09-08 | TT-SGP-AIRPRT-3956 |
| `04df9d37-6f0e-4615-9508-3791ec2ef4e7` | 2026-09-08 | TT-SGP-AIRPRT-3958 |
| `bc328179-2a48-4ba8-b18c-ad0da6b93014` | 2026-09-08 | TT-SGP-AIRPRT-3960 |
| `9f204b45-a7f0-44ba-b344-bcfc241924d2` | 2026-09-08 | TT-SGP-AIRPRT-3962 |
| `d6185f72-ecce-44be-9a80-982b753a32e5` | 2026-09-08 | TT-SGP-AIRPRT-3965 |
| `0a72dd35-a8f7-4638-b836-67b72e5d0b01` | 2026-09-08 | TT-SGP-AIRPRT-3967 |
| `3fbde88f-6744-4bdd-9216-de966e5f27de` | 2026-09-08 | TT-SGP-AIRPRT-3970 |
| `302b3d73-5428-4f06-990b-fce1cade5abb` | 2026-09-09 | TT-SGP-AIRPRT-3983 |
| `573de7a3-e1ae-4176-bd9c-5acd2393d0f8` | 2026-09-09 | TT-SGP-AIRPRT-3986 |
| `3d5fe66c-4cb4-4368-9554-e057b2e790f7` | 2026-09-09 | TT-SGP-AIRPRT-3988 |
| `8d063520-b5a8-47ad-9275-a13c0a22eecb` | 2026-09-09 | TT-SGP-AIRPRT-3990 |
| `5719be6c-ff8a-4331-9a0b-be093fcf05d3` | 2026-09-09 | TT-SGP-AIRPRT-4023 |
| `1e7133d5-cc61-4c3d-a818-780ed600e243` | 2026-09-09 | TT-SGP-AIRPRT-4025 |
| `bdb17de7-442b-448d-b48e-2284e3765a67` | 2026-09-09 | TT-SGP-AIRPRT-4027 |
| `e3514d5c-e3d0-4b5f-b8af-833cdfd2f56f` | 2026-09-09 | TT-SGP-AIRPRT-4029 |
| `c30b741b-7f18-4b7d-a480-63659a513f40` | 2026-09-09 | TT-SGP-AIRPRT-4048 |
| `0f12422d-db0f-4301-b2bd-66884b352178` | 2026-09-09 | TT-SGP-AIRPRT-4071 |
| `27288506-2c8d-4107-a69c-aa5311c83e37` | 2026-09-09 | TT-SGP-AIRPRT-4094 |

**The production of new ones is already stopped** (`dff123c`), measured raw
25 -> 26 against ledgered 25 -> 25, and confirmed by three full gate runs since
adding none.

### APPROVED AND EXECUTED, 2026-09-10

Soft delete per Verification 11. `records` carries `ON DELETE RESTRICT` from
`record_revisions`, `approvals` and `audit_log`, so a hard delete is blocked or
orphans history, and a `reference_number_counters` row is never touched at all.

```
ids parsed from the close-out list: 25
live before the sweep: 25 of 25 found
  ... 25 lines, each re-queried after its own update ...
  25 of 25 soft deleted

RESIDUE RE-QUERIED STRUCTURALLY: 0 live readonly-approver opportunities
```

**The list and the database are asked separately.** The ids come from this
document, as ruled; the residue count is then taken STRUCTURALLY by payload
name across all owners, because a list records what you meant to sweep and only
the database records what is there (Verification 11, and build discipline 8:
scope the cleanup to what the actor did, not to what the list names).

Every delete is confirmed by re-querying `deleted_at` on that id, never by
trusting the update's own result.

| | before | after |
|---|---|---|
| live records, exact count | 135 | **110** |
| live `readonly-approver` opportunities | 25 | **0** |
| `reference_number_counters` rows, exact count | 3,735 | **3,735** |

**AND THE COUNTER FIGURE IS AN EXACT COUNT, NOT A PAGE.** The sweep script's
first pass read the counters with a plain select and printed **1,000**, which is
PostgREST's default cap and not a number at all. That is this round's own
carried finding arriving in the script written to close the round, one screen
below where it is documented. Re-taken with `head: true, count: 'exact'`: 3,735.

---

## 3. R10's acceptance test, as ruled

> the beds already past their `estGoLiveDate` show red on first render

```
today 2026-09-10
live beds 9; past their contracted end 5; not yet due 4
of the overdue, carrying a go-live stamp: 0

OK  3e69041d  end 2026-09-02  expect RED    got RED    Review and Completion
OK  9673244b  end 2026-08-25  expect RED    got RED    Installation and Commissioning
OK  01212278  end 2026-09-03  expect RED    got RED    Closed
OK  37594c21  end 2026-09-09  expect RED    got RED    Closed
OK  2865d25c  end 2026-08-31  expect RED    got RED    Closed
OK  ccde659b  end 2027-02-15  expect plain  got plain  Qualification   (control, 1 of 2 sampled)
OK  264010b1  end 2026-10-27  expect plain  got plain  Closed          (control, 2 of 2 sampled)

5 of 5 overdue beds render RED on first load
2 of the 4 not-yet-due beds visited, both render PLAIN
```

**PRECISION, John's correction at the close.** The control arm is **2 of the 4**
not-yet-due beds, not all of them: the probe visits every overdue bed and takes
the first two of the rest. The overdue claim is exhaustive; the control claim is
a sample, and it is stated as a sample.

**The pair is the instrument.** A probe that only visited overdue beds would
report red against a build that painted every end date red. Overdue read
`rgb(224,108,108)`; not-yet-due read `rgb(242,242,240)`.

**NO BACKFILL WAS REQUIRED, confirmed by the same render.** None of the five
carries a `testBedGoLiveDate`, so every one of those dates was typed by hand
before this round existed, and the check only reads. One of the five is still
AT Installation and Commissioning: it has not gone live, has no calculated end,
and its hand-entered date highlights correctly.

The population is read from the database, not typed: a list of five ids would
go stale the moment a date moved, and the claim is about every overdue bed.

Screenshot per Verification 4, of the strip itself rather than the page:
`.verify/tb-overdue/overdue-strip.png`, five cells in one row with the
contracted end red inside its border.

---

## 4. Gate

**22/22 PASS on `dff123c`**, 422s, working tree clean, nothing else running.

```
pure suite     508/508      react suite    932/932
database       98/98        react typecheck PASS
HTTP readonly-view probe    PASS  53319ms
```

The door stage is **PASS, not SKIP**, on the exact committed tree with the
browser present, which is the previous round's R15 satisfied at close.

**Two earlier gate runs are recorded rather than hidden.** The first, on
`318aa04`, went **RED at `react typecheck`** and caught a real defect in this
close's own work: a check using `node:fs` inside the react program. It is the
reason `bce3a07` exists. A gate that only ever confirms is not doing anything.

---

## 5. Commits reconciled by counting

**The brief returns 1 phase heading**, which is exactly the result build
discipline 7 names as the dangerous one: a zero is obviously broken and a
plausible number is not. This brief carries `## Workstream 1/2` and a single
`## Phase 0`; Phase 1 was launched in conversation. So the enumeration is by
**sign-off**, as the rule instructs.

| launched by | commits | |
|---|---|---|
| Round instruction (brief, A1, Phase 0) | 3 | `cfee8fc` `ca9918e` `ee314cd` |
| Rulings R1-R12, appended at the phase they launch | 5 | `e2afbf6` `4cac905` `83662e8` `91bb238` `db08cad` |
| Phase 1 sign-off (R10, R11, W1) | 3 | `645f574` `3bacf09` `0d3b07a` |
| Close instruction | 6 | `2ed843f` `e772c07` `a5a8f80` `318aa04` `bce3a07` `dff123c` |
| **Total** | **17** | matches `git rev-list --count origin/main..HEAD` |

Five ruling commits for twelve rulings, each appended when it was given rather
than discovered at the close, which is the named cause-and-fix in rule 7.

---

## 6. Revert rehearsal, and its boundary

Run on a **worktree at `origin/main`**, so `main`'s tree was never touched -
Verification 44's own warning, where a targeted restore poisoned the index and
left the working tree carrying pre-fix source while `git status` looked calm.

| check | result |
|---|---|
| reverted tree vs `origin/main` | **0 diff lines** |
| pure suite on the reverted tree | exit 0, 4s |
| react suite on the reverted tree | exit 0, **915/915** (vs 932 now: +17) |
| `main` tree hash before | `8f4344e3877fbb86801e689224a6368c851d62fc` |
| `main` tree hash after teardown | **identical** |

**THE BOUNDARY, stated because a revert that is described rather than bounded
is a claim:**

- **Reverts cleanly:** all 17 commits. No migration was written this round -
  R10 was *proven*, not built, because the transition stamp already existed - so
  there is **no schema to unwind and no ledger row to reconcile**.
- **Does NOT revert:** the data. The R10 proof moved bed `3e69041d` from
  Installation and Commissioning to Monitoring and Analysis, revision 2 -> 3,
  stamping `testBedGoLiveDate 2026-09-10` and `estGoLiveDate 2027-03-10`. That
  is a real transition on a real record and a revert of the code leaves it
  where it is.
- **Does NOT revert:** the 25 residue records above, nor the soft deletes this
  close performed on the two fixtures it created itself.
- **The bundle travels with the source.** `react bundle freshness` is a gate
  stage, so a revert that moved one without the other fails the gate rather
  than shipping a mismatch.

---

## 7. `CURRENT_STATE.md`

Regenerated at `a5a8f80`. **Staleness, both halves, and half 2's empty is
calibrated rather than assumed:**

| half | result |
|---|---|
| recorded sha is an ancestor of `HEAD` | **PASS** |
| no tracked configuration source changed since | **PASS** (empty) |
| *calibration:* the same query over `4e7460b~1..HEAD` | returns three files, so an empty answer is an answer |

**Reconciled against the phases (rule 6): every line that moved is a COUNT.**
No stage definition, no gate rule, no approval rule, no route moved, which
matches a round whose work was frontend and whose R10 was a proof.

**And for the first time the regeneration diff produced a FINDING rather than
confirming one:** +3 live opportunities no phase accounted for. That is section
2, and it is what rule 6 is for.

---

## 8. Promotions into `CLAUDE.md`

Both **extend an existing rule**. Rule 32 holds: the rule count is unchanged,
nothing renumbered, and a placement walk-back confirmed each landed under
`## Verification` and inside the rule it belongs to - the check that was missing
last round, when two promotions went into the wrong section because rule numbers
repeat across the three families.

**Verification 4 gains the layout-class clause.** A grid's column count is a
property of the CLASS, and an assertion about the children cannot see it. Every
check passed on the wrapped strip **including the one about order**, because
wrapping preserves DOM order. The clause names an automatable check, so the
check was built (`scripts/tests/stats-grid-cells-match.test.mjs`), calibrated
3/3 with green at both ends.

**Verification 8 gains the fixture clause.** The rule's instances are all
product code and its sentence describes what the WRITER sees. An unchecked
insert in a FIXTURE points the diagnosis at the subject instead: six failed in
the R10 probe, the transition then refused on an unmet exit criterion, and the
reading that follows is that the gate is wrong.

**A third candidate was rejected as a duplicate.** The placement walk-back is
already Verification 44's territory and needed no new text.

---

## 9. Carried to the next brief, in John's order

**Ruled at the close, 2026-09-10. This list supersedes the one this document
carried before the word; the two items of mine it does not carry are named at
the bottom rather than dropped silently.**

1. **The blind tag query. FIRST OPENING ACT.** `tearDown`'s tag branch is
   range-capped at **1,000 of 23,066 rows**. Paginate or filter the query,
   **calibrated on a population larger than the page cap** and **shown reaching
   a record beyond row 1,000**.

   > **Until it lands, every teardown claim carries the 96%-blind asterisk.**

   That sentence is the ruling's teeth and belongs in the next brief verbatim:
   it makes the gap a stated condition on other people's evidence rather than a
   task on a list. The calibration is specified in a way that a passing check
   cannot fake - a page-sized population would go green while proving nothing,
   which is the exact shape that produced the finding.

2. **The remaining raw-handover call sites**, 13 after this round's fix,
   **converted or confirmed historical**. Measured comment-stripped: 16 files
   match, of which `fixtures.mjs` (the helper) and `teardown-scoping.test.mjs`
   (its test) are legitimate. "Confirmed historical" is an allowed disposition,
   which is Verification 41's shape: the enumeration with a disposition each IS
   the instrument.

3. **The vanilla retirement class**, three duplicates one job. **The tripwires
   stand until then** - `vanilla-duplicates-frozen.test.mjs` keeps failing any
   edit that lands in a dead surface, which is what caught an edit landing in
   `#deal-form-vanilla` while source verification passed and the screen did not
   move.

4. **The 19 routes unexercised as a non-owner, and concurrency.**

5. **The `complete-document` disagreement, recorded not resolved.**

**Raised in this close and NOT carried by the ruling**, recorded so they are
absent by decision rather than by oversight:

- The fixture ledger paths are hardcoded to a previous session's scratchpad
  directory. They work today because that directory still exists.
- The reverse-direction census now exists for test files (`bce3a07`), but
  nothing does the same for probe scripts or gate stages.

Both are adjacent to item 1 and will most naturally be met while doing it.

## 10. What this close does NOT establish

- **Nothing about W2's correctness as a product decision.** The mechanism was
  measured; whether one number is the right carry-forward is unasked.
- **Nothing about whether `accumulated_cost` is maintained correctly** - only
  where it lives and that the header and the carry-forward read the same field.
- **The overdue highlight is proven on 9 live beds**, not on the full
  soft-deleted population.
- **The door on the Test Bed view is proven by the enumerator**
  (`113/39/0 reachable` not-mine against `113/39/39` mine), not by a human walk.
- **No walk was run this round.** The estate's stopping condition is a walk,
  and the screenshot in section 3 is not one.
