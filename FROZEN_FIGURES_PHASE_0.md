# FROZEN_FIGURES Phase 0 (read-only): what re-derives today, and the rulings to make

**Branch `frozen-figures`, off `488f779`.** ls-remote origin main read `488f779b813b179b7c78646dbe32d6c0f650f464`. The brief verbatim is `f916457`. Nothing is built, applied or written. Every live read used the service key, select only.

## First: a correction to what I told you, and to the brief's premise
**I reported in TP_LADDER that "no version froze rates.batches". That was wrong, and the brief repeats it.**
- **6,357 of 6,375 versions froze their batches.** The save route writes `catalog.batches`, an OBJECT keyed by product (batch id, label, effective date), into `rates.batches`.
- **The approval page checks `Array.isArray(version.rates.batches)`** (`src/lib/approval-page.js:888`), which is false for an object, so it always falls back to today's catalog. My A3 measurement used the same test and inherited the same blindness.
- **H3** ("the cost basis is the version's", `3d58141`, 2026-09-29) has **no test**; every "H3" test in the suite belongs to a different ruling. So nothing could fail.

The 3,792 issued versions re-dating to the 2026-11-17 batch was real, but **its cause is this reader, not missing data.** R-FF3 is therefore mostly a one-line reader fix plus the test H3 never had. The frozen batch ids already exist on 6,357 versions, so no backfill is needed for R-FF3.

## STOP conditions, each checked
- **No CONFIRMED golden moves.** The goldens are fixtures priced through `calculateDeal`, with no database and no versions (`scripts/golden-deals/engine.mjs` imports only the engine). All five exact today; nothing proposed here touches the engine.
- **No route can write stored figures after approval.** No stored figures exist yet. An issued row refuses EVERY update, for every role including the service role, in the `deal_sheet_versions_immutable` trigger (latest definition `20260829000001`). That is read from the code, not exercised in this phase.
- **Live records: the stop needs your ruling, not mine.** All 19 live Opportunities are owned by two personal accounts (12 by a terminustechnologies.io address, 7 by a gmail address), neither a probe account. You state they are test data, and I can't verify that from the database. Rule it and I'll record it.

## 1. Where an approved version's figures are shown or read, and which re-derive
| surface | reads | re-derives through today's engine? |
|---|---|---|
| **approval page** (`buildApprovalPage`; route `GET /opportunities/:id/approval-page`; React `ApprovalView`) | the version's `inputs` and `rates.rates` | **yes, every figure**: headline, target, exposures, the bridge. The cost basis uses **today's catalog** (the reader defect above) |
| version list and card (`GET .../deal-sheet-versions`, `versionApprovalState`, `VersionCard`) | approval STATE and `inputs` (has pricing changed since) | no figures shown |
| restore | `inputs`, back into the form | no figures |
| Opportunity headline and list column (`opportunity-headline.js`) | the RECORD's payload, against the **live** catalog | yes, and **not a version at all**: this is what a Closed Won deal shows |
| transition staleness (`transition-requests.js:195`) | `inputs` | no figures |
| decide (`decide_transition_request`, SQL) | approvals and tracks | no figures |

**So one surface shows a version's figures (the approval page), and it re-derives all of them.** The other surface that matters, the Opportunity headline, never looks at a version.

## 2. The table, the guard, and the smallest storage
**`deal_sheet_versions` today:**
- the columns that hold what a version records: `inputs`, `rates` (which holds `rates`, `batches`, `missing`, `as_of`, `terms`, `overridden`, `absent`), `sections`, `batch_id`, `revision_number`, `reason`, `created_by`, `created_by_email`, `created_at`;
- the issue fields: `status`, `major`, `minor`, `issued_by`, `issued_by_email`, `issued_at`.

**The trigger:**
- an issued row refuses every update;
- the draft -> issued relabel may change only status, number and issuer, and every other column must be unchanged;
- `version-guard.test.mjs` fails any new column that is neither guarded nor named exempt with a reason.

**Recommendation: one jsonb column, `frozen_figures`, not columns.** The figures the page and the deal sheet show are ~40 values today and will grow. Columns would make every new figure a migration and a guard edit, while a snapshot is one immutable blob. It holds:
- the page's priced blocks, and `calculateDeal`'s output they come from;
- `engine` (the server's git SHA and a sha256 of `deal-calculator.js`);
- `batches`: the same batch ids already frozen in `rates.batches`, repeated so the snapshot stands alone;
- `frozen_at`.

**Where it is written: at SUBMISSION (the issue route), by the SERVER, in the same UPDATE as the relabel.** This follows from three findings:
- **"Approve pricing" is not issue.** Issue is "submit for approval" (the route's own sentences; the screen reads "awaiting approval"). Approval is later, when every track signs in `decide_transition_request`, which is SQL and cannot run the JS engine.
- **The decision of record already says this.** DESIGN_PRINCIPLES section 3, rule 1: figures a decision rests on are "recomputed and verified server-side at submission time. Never trust client-submitted numbers". Rule 6: "outputs are frozen and stored specifically at submission and at approval". The issued row is immutable from submission, so the figures frozen then ARE what every approver signs. Freezing again at approval would need the trigger to let an issued row change, which weakens R-FF5.
- **A direct PostgREST call must not be able to forge them.** The owner can update a draft through RLS today. If `frozen_figures` were only exempt in the relabel, the owner could issue with forged figures. So the trigger lets `frozen_figures` be set **only on the draft -> issued relabel, only when `current_user = 'service_role'`**. The issue route keeps its ownership check, then relabels with the service client.

Draft migration, **report only, not parse-checked (rule 14), no ledger row in the file**:

```sql
-- FROZEN_FIGURES: a version freezes its figures at submission (R-FF1, R-FF5). DRAFT.
alter table public.deal_sheet_versions add column if not exists frozen_figures jsonb;
alter table public.deal_sheet_versions drop constraint if exists deal_sheet_versions_figures_only_when_issued;
alter table public.deal_sheet_versions add constraint deal_sheet_versions_figures_only_when_issued
  check (frozen_figures is null or status = 'issued');

create or replace function public.deal_sheet_versions_immutable()
returns trigger language plpgsql as $$
begin
  if OLD.status = 'issued' then
    raise exception 'deal_sheet_versions: V%.% is issued and cannot be changed (id %)', OLD.major, OLD.minor, OLD.id
      using errcode = 'restrict_violation';
  end if;
  if NEW.status = 'draft' then
    if NEW.frozen_figures is not null then
      raise exception 'deal_sheet_versions: a draft carries no frozen figures (id %)', OLD.id using errcode = 'restrict_violation';
    end if;
    return NEW;
  end if;
  if NEW.major is distinct from OLD.major + 1 or NEW.minor is distinct from 0 then
    raise exception 'deal_sheet_versions: issuing V%.% must produce V%.0, not V%.%',
      OLD.major, OLD.minor, OLD.major + 1, NEW.major, NEW.minor using errcode = 'restrict_violation';
  end if;
  if NEW.record_id is distinct from OLD.record_id or NEW.reason is distinct from OLD.reason
  or NEW.inputs is distinct from OLD.inputs or NEW.rates is distinct from OLD.rates
  or NEW.sections is distinct from OLD.sections or NEW.batch_id is distinct from OLD.batch_id
  or NEW.revision_number is distinct from OLD.revision_number or NEW.created_by is distinct from OLD.created_by
  or NEW.created_by_email is distinct from OLD.created_by_email or NEW.created_at is distinct from OLD.created_at then
    raise exception 'deal_sheet_versions: issuing may set the status, number, issuer and frozen figures only (id %)', OLD.id
      using errcode = 'restrict_violation';
  end if;
  -- R-FF1, rule 1: the figures are the SERVER's, computed at submission. Required on issue, and only the
  -- service role may write them, so neither a client nor a direct PostgREST call can supply them.
  if NEW.frozen_figures is null then
    raise exception 'deal_sheet_versions: issuing must freeze the figures (id %)', OLD.id using errcode = 'restrict_violation';
  end if;
  if current_user <> 'service_role' then
    raise exception 'deal_sheet_versions: only the server may freeze figures (id %)', OLD.id using errcode = 'insufficient_privilege';
  end if;
  return NEW;
end; $$;
```

`version-guard.test.mjs` would name `frozen_figures` EXEMPT, with the reason "set once, by the relabel, server only; the trigger refuses it on a draft and after issue". R-FF5's proof would be two database tests on a fixture version: an update as the owner (refused by RLS and the trigger) and as the service role (refused by the trigger), each fingerprinted before and after.

## 3. Closed Won
- **Nothing links an Opportunity to a "won version" today.**
  - `e5f8f1de` closed through an approved Negotiating -> Closed Won request whose `frozen_version_id` is **null**. The only version link in its history is Proposal -> Evaluation, which froze V2.0 (`41964243`).
  - `ea9aefb4` is Closed Won with **no versions, no transition requests and no status audit**: it was set directly, as a fixture.
- **A Closed Won deal shows the live payload priced at the live catalog**, which is why it moved with the 2026-11-17 batch.
- **A Closed Won record stays editable.** `PATCH /opportunities/:id` has no terminal-stage refusal; the search is calibrated by the terminal check it does find in the Closed Lost route of the same file. Only an open transition request freezes a record.

**Proposed for R-FF4:**
- The raise into a terminal Won stage derives (Architecture 12: the definer derives, never accepts) and freezes the latest APPROVED version into the request's `frozen_version_id`. That is the won version.
- The headline for a Closed Won record reads that version's `frozen_figures`, labelled as the won version's.
- A Closed Won record with no won version (`ea9aefb4`, and any closed before this) shows its live figures with a plain line: "No approved version was won; these are today's figures."
- **For you: should pricing edits to a Closed Won record be refused?** The headline would no longer move, but the payload still could. Refusing is a new rule and its own decision.

## 4. R-FF6, measured both ways
| | count |
|---|---|
| versions | 6,375 (exact) |
| issued | 3,803 |
| issued on live Opportunities | 16 |
| approved by a closed review | 630 (6 on live) |

**SMARTC-003** (`TT-SGP-SMARTC-003`, `d86369b3`, V2.0 `ac853f99`):

| figure | engine at `a5b8e80` (as approved) | today's engine (a backfill now) |
|---|---|---|
| finance cost | 258,493 | **258,976** |
| total deal cost | 1,080,893 | 1,081,376 |
| achieved margin | 7.66% | 7.62% |

- Of the 3,803 issued versions, this is the **only one** whose figures differ between those two engines. That measures ONE engine change.
- **No record says which engine priced any version when it was submitted**: the server ran whatever tree was checked out. So a backfill can store only what today's engine says, never what was approved. Labelling SMARTC-003 "approved at 258,976" would put a figure nobody signed under a signature.
- **A backfill also needs the immutability trigger lifted** for 3,803 issued rows, for every role. That is the weakening R-FF5 exists to prevent, done at scale.

**Recommendation: no backfill.** Legacy versions (`frozen_figures` null) go on re-deriving, and the page says so in the place the figures are read. No bulk write, as briefed.

## 5. Goldens
Confirmed (see the STOP conditions).

## 6. Conflicts with decisions of record, each with a recommendation
1. **The brief's "Approve pricing, which is also issue today": issue is submission, approval is later** (section 2). Freeze at submission, per rule 1, which is also the moment after which the row cannot change.
2. **CLAUDE.md Architecture 2, "Computed values are computed, not stored", sits beside "Approved snapshots are immutable".** DESIGN_PRINCIPLES rule 6 already names the one exception, "the audit snapshot... at submission and at approval... never read back as if it were the current forecast". Recommendation: record `frozen_figures` as that exception. It is never read as current: the headline reads it only for a Closed Won record, and says whose figures they are.
3. **DESIGN_PRINCIPLES "COMMERCIALS FACTORING" decision 4 (option a)** is re-taken, not re-weighed: its premise (no real approval yet) was recorded as the trigger, and it is superseded with its reasoning left visible.
4. **H3 (2026-09-29)** stands as ruled. Its reader is fixed and it gets its first test.
5. **R-L4, "issued is reserved for the customer-send event"**: nothing here uses the word on screen. The DB word stays.

## Proposed wording (R-FF2)
- Beside a figure that differs: "Today's engine prices this at {X}; the approved figure stands."
- At the head of a legacy version: "Submitted before figures were frozen. Every figure below is today's engine's, from this version's frozen inputs and rates."

## The rider
`scripts/state-dump.mjs` gains the current batch per product (label, effective date, the four costs), so the 2026-11-17 batch is the first entry in the changelog.

## Rulings needed
1. **R-FF1:** freeze at SUBMISSION (the issue route, server only, service role, one UPDATE), not at final approval.
2. **R-FF5 mechanism:** the trigger above (set once, on the relabel, service role only; required on issue).
3. **R-FF4:** the won-version link through the terminal raise; and whether a Closed Won record's pricing becomes uneditable.
4. **R-FF6:** no backfill; legacy versions re-derive with the label.
5. **R-FF2:** the wording above, or yours.
6. **The live-records stop:** confirm the 19 live Opportunities (two personal owners) are test data.
7. **The correction:** recorded, and R-FF3 rescoped to the reader fix and its first test.

**STOPPED, as briefed.**
