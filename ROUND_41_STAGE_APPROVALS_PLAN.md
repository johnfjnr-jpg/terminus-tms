# Stage approvals workflow: the plan

**REPORT AND PLAN ONLY. No code, no schema.** John reviews this before anything
is built.

Written 2026-08-31, replacing fix-panel point 3. Points 1, 2, 4 and 5 of the fix
panel do not depend on it and proceed as written.

---

## 1. What exists today, enumerated both directions

### 1a. The stage-gate rule data, from the database

**92 rows in `stage_gate_rules`, four requirement types.** The Opportunity's, in
full:

| transition | requirements |
|---|---|
| Qualification → Solution Alignment | `assessmentReviewed` |
| Solution Alignment → Proposal | 4 exit criteria, `assessmentReviewed`, **Technical/stage**, **Legal/stage**, **Commercial/version** |
| Proposal → Evaluation | 3 exit criteria, `assessmentReviewed`, **Technical/stage**, **Legal/stage**, **Commercial/version** |
| Evaluation → Negotiating | 3 exit criteria, **Technical/stage**, **Legal/stage**, **Commercial/version** |
| Negotiating → Closed Won | 5 exit criteria, `assessmentReviewed`, **Technical/stage**, **Legal/stage**, **Commercial/version** |

**Three tracks, two scopes, and the scope split is the Verification 23 conflict
this workflow removes.** `stage` means an approval survives every revision;
`version` means it binds to a deal sheet version. **The new model has one scope
and no revision in it at all**, which is the substantive simplification: a
request is of a frozen state, so nothing can undercut it.

### 1b. Server write paths, from the routes

**Sixteen write endpoints can change an Opportunity.** Grouped by what the freeze
must do with each:

| endpoint | under an open request |
|---|---|
| `PATCH /opportunities/:id` | **frozen** |
| `POST /opportunities/:id/close-date-move` | **frozen** |
| `PUT /opportunities/:id/probability-override` | **frozen** |
| `POST /opportunities/:id/assessment-reviewed` | **frozen** |
| `POST /opportunities/:id/scores` | **frozen** |
| `POST /opportunities/:id/key-contacts` | **frozen** |
| `POST /opportunities/:id/key-contacts/:linkId/stance` | **frozen** |
| `DELETE /opportunities/:id/key-contacts/:linkId` | **frozen** |
| `POST /opportunities/:id/close-lost` | **frozen** |
| `POST /opportunities/:id/deal-sheet-versions` | **frozen** |
| `POST /deal-sheet-versions/:vid/issue` | **frozen**, except see 3d |
| ~~`POST /deal-sheet-versions/:vid/restore`~~ | **CORRECTED: it writes nothing.** See the freeze-coverage measurement below |
| `POST /records/:id/transition` | **replaced**, see section 3 |
| `POST /records/:id/approvals` | **replaced**, keyed to the request |
| `POST /deals/submit` | read-only already; unaffected |
| `POST /records` | creation; unaffected |

**Eight underlying tables** are reachable from those endpoints and every one has
to be covered by the trigger, not just `record_revisions`:
`records`, `record_revisions`, `opportunity_details`, `record_contacts`,
`record_contact_stances`, `deal_sheet_versions`, `approvals`, `audit_log`.

### 1c. Client call sites, from the frontend

**Seventeen**, and the count matters because every one is a control that has to
know about the freeze:

`app.js` close-lost, two score paths, assessment-reviewed, transition, approval
submit, `oppPatch`; `opportunity-deal.js` version save, issue, restore, deal
save; `opportunity-reference.js` key-contact add, stance, delete, generic save,
close-date-move.

### 1d. The evaluator

`computeBlocking(db, record, from_stage, to_stage, currentRevision, revPayload)`
in `transitions.js` is **the one gate computation path**, and both the transition
route and the stage panel call it. **It stays.** What changes is what an
`approval_obtained` requirement reads.

---

## 2. The schema

**An extension of the records engine, not a fork.** `transition_requests` is a
new table about a record; approvals gain a foreign key; nothing about `records`
or `record_revisions` changes shape.

### 2a. `transition_requests`

```
id                uuid    pk
record_id         uuid    not null  -> records(id) on delete restrict
record_type       text    not null            -- denormalised for the trigger's speed
from_stage        text    not null
to_stage          text    not null
kind              text    not null  check (kind in ('transition','review'))
status            text    not null  check (status in ('open','approved','rejected','withdrawn'))
frozen_revision   integer not null            -- the revision the request is OF
frozen_version_id uuid    null -> deal_sheet_versions(id)   -- Proposal -> Evaluation
requested_by      uuid    not null -> auth.users(id)
requested_at      timestamptz not null default now()
closed_by         uuid    null
closed_at         timestamptz null
close_reason      text    null                -- required on rejected and withdrawn
```

**One open request per record**, enforced by a partial unique index rather than
by a route:

```
create unique index transition_requests_one_open
  on public.transition_requests (record_id)
  where status = 'open' and kind = 'transition';
```

**`kind` carries the reissue case.** A `review` request does not freeze and does
not execute a transition; it is the same row shape because it is the same object
- a thing three tracks are asked to look at - and a second table would be the
fork.

### 2b. `approvals` gains the link

```
alter table public.approvals
  add column request_id uuid references public.transition_requests(id) on delete restrict;

create unique index approvals_one_per_request_track
  on public.approvals (request_id, track)
  where request_id is not null;
```

**`(request, track)`, as ruled.** Note it is **not** `(request, track, approver)`:
one approval per track is the point, so a second approver on the same track is
refused rather than silently added. The existing `(record, revision, track,
approver)` uniqueness stays for the rows that predate this.

**`revision_number` stays populated** for a request-bound approval, taken from
`frozen_revision`. It is redundant to the gate and it is the audit trail: an
approval row that cannot say which state it approved is worth less than one that
can.

### 2c. The freeze trigger

**The same instrument as `deal_sheet_versions_immutable`, and for the reason that
migration already records: triggers fire for every role, BYPASSRLS included, and
a route guard alone is a declared policy rather than an enforcement.**

One function, attached to each covered table:

```sql
create or replace function public.refuse_write_while_frozen()
returns trigger language plpgsql as $$
declare v_record uuid; v_req record;
begin
  v_record := coalesce(new.record_id, old.record_id);
  if v_record is null then return coalesce(new, old); end if;

  select id, to_stage, requested_by into v_req
  from public.transition_requests
  where record_id = v_record and status = 'open' and kind = 'transition'
  limit 1;

  if v_req.id is null then return coalesce(new, old); end if;

  raise exception
    'This record is frozen: a transition to % is awaiting approval. '
    'Withdraw the request to edit it.', v_req.to_stage
    using errcode = 'PT423';
end $$;
```

**Attached to:** `record_revisions`, `opportunity_details`, `record_contacts`,
`record_contact_stances`, `deal_sheet_versions`, and `records` (status only).

**NOT attached to `approvals` or `audit_log`** - those are the writes the freeze
exists to permit.

**PT423, a new SQLSTATE**, mapped to HTTP 423 Locked by `sendWriteError`. It is
deliberately not PT409: a conflict says "reload and try again", a freeze says
"this is waiting for somebody else".

**Three things this trigger must be shown doing before it is trusted**, per
Verification 9, and they are the calibration plan rather than a promise:
refusing a `record_revisions` insert as the **service role**; refusing an
`opportunity_details` update; and **allowing** an `approvals` insert on the same
frozen record.

### 2d. What the trigger CANNOT do, stated now

**It cannot tell an approval-driven write from any other**, because it sees only
a row. The transition's own execution - the `records.status` update - happens
while a request is open, so the executor either runs in a transaction that first
closes the request, or the trigger exempts a status change to `to_stage` when the
request is `approved`. **The plan takes the first**: close the request, then
transition, in one transaction. It keeps the trigger's condition to one sentence.

---

## 3. Routes and client, screen by screen

### 3a. New routes

| route | what it does |
|---|---|
| `POST /records/:id/transition-requests` | body `{ to_stage }`. Runs `computeBlocking` for **everything except the approval requirements**, refuses if any exit criterion is unmet, then opens the request at the current revision |
| `POST /transition-requests/:id/approvals` | body `{ track, decision, reason? }`. Reason **required** on reject. On the last required track approving, executes the transition in the same transaction |
| `POST /transition-requests/:id/withdraw` | requester or an admin only. Closes and unfreezes |
| `GET /transition-requests?status=open&track=…` | **the approver queue** |
| `GET /records/:id/transition-requests` | the record's own history, open and closed |

### 3b. Changed routes

| route | change |
|---|---|
| `POST /records/:id/transition` | **REMOVED for Opportunity.** Test Bed and Contact keep it: their gates have no approval requirements of this kind, and forcing them through requests would be a fork of the workflow for no gain |
| `POST /records/:id/approvals` | **REMOVED for Opportunity.** Kept for Test Bed |
| `approvalSatisfiesRule` | the `version` and `stage` scope branches both collapse into **"an approval exists on the open request for this track"**. `ruleScope`, `loadVersionApproval` and `liveVersionApproval` lose their callers in the gate path |
| every frozen endpoint | catches PT423 and returns 423 with the trigger's message |

### 3c. Controls that change meaning or disappear

| control | today | after |
|---|---|---|
| **Advance to `<stage>`** button, stage panel | calls `POST /transition` and either moves the record or lists blockers | **Request transition**. Same position, different verb and different outcome: it creates a request and the record freezes |
| **Approve** row in the stage approvals table | `POST /records/:id/approvals`, one per track per revision | binds to the open request. **Disabled with a reason when no request is open**, which is the state that produced the walk failure |
| **Save changes**, Commercials | enabled when dirty | **disabled while frozen**, with the reason on the button |
| **Save version / Issue latest draft / Restore** | always available | **disabled while frozen** |
| **Reference tab field editors** | click to edit | **read-only while frozen** |
| **Assessment score entry** | click a level | **read-only while frozen** |
| **Exit criteria ticks** | clickable | **read-only while frozen** |
| **Est. Close Date move** | its own dialogue | **disabled while frozen** |
| **Key contacts add / stance / remove** | available | **disabled while frozen** |
| **Close lost** | available | **disabled while frozen**; closing lost under an open request means withdrawing first |
| — | — | **NEW: a freeze banner** at the top of the record naming the request, who raised it, when, and which tracks are outstanding |
| — | — | **NEW: Withdraw request**, visible to the requester |
| — | — | **NEW: an approver queue view**, `GET /transition-requests?status=open`, the same list the reissue reviews land in |

**Every one of those disabled states reads its condition from ONE loaded value**
- the record's open request, returned by `GET /records/:id` alongside the record
- rather than each control testing for itself. Verification 20: a second reader
of the same value always drifts.

### 3d. Proposal → Evaluation, the extra requirement

**An issued version with no unissued draft changes after it.** Two checks, and
the second is the one that needs stating:

1. a `deal_sheet_versions` row for this record with `status = 'issued'`
2. **no draft version, and no record revision, after that version's
   `revision_number`**

The request stores it in `frozen_version_id`, and **the frozen state for that
request is the issued proposal** rather than the current revision. `Issue latest
draft` is therefore permitted *before* the request and refused during it.

### 3e. Reissues

**V2 onward in Evaluation and Negotiating raise a `kind = 'review'` request to
all three tracks.** It does not freeze, does not block editing, and executes no
transition. It appears in the Approvals panel and in the approver queue.

**No notification integration.** The request is the object a notification would
later point at, which is the reason to create it now rather than a placeholder.

---

## 4. Cutover

### 4a. Existing approval rows

**882 rows across all record types. None is deleted and none is migrated.**

`request_id` is nullable. A row with a null `request_id` is a **pre-workflow
approval** and the gate does not read it. They remain readable as history, which
is what the ruling asks for: closed requests and their approvals are the audit
trail, and so is everything that came before.

### 4b. Open opportunities mid-stage

**Four live opportunities. Three are open, one is Closed Won.** No opportunity is
mid-transition, because a transition is instantaneous today - there is no state
to be caught in.

**So the cutover is: nothing to migrate, and the first transition after the
change goes through a request.** The three open records keep their exit criteria
and their scores; what they lose is the effect of any approval already recorded,
which the walk has established was already worthless on the Commercial track.

### 4c. Test data

**Deletable rather than migrable, per the ruling.** The specific rows this makes
disposable:

- **the four approvals on TT-SGP-SMARTC-003**, three of which can never count
- **V1.0 with its null `revision_number`**, the row that made the Commercial
  track unapprovable

**Deleting that version removes the cause of walk finding 3 outright**, and it is
worth saying plainly: the alternative to deleting one test row is building a
screen that explains an unapprovable version to a user who will never see one
again once this workflow ships.

**Soft delete, and `reference_number_counters` is untouched.** Verification 11.

### 4d. What must be true before cutover

- the freeze trigger calibrated in all three directions (2c)
- the partial unique index shown refusing a second open request
- **a full gate run against a record with an open request**, since every HTTP
  probe currently assumes it can write

---

## 5. What this makes reachable for Adobe Sign

**Named, not designed.**

**A request is a durable object with a lifecycle**, which is the thing an
external signing flow needs to attach to and which today's model does not have:
an approval keyed to a revision has no identity a webhook can address.

Specifically, it makes these reachable without further structural work:

- **an external decision on an internal object.** `POST /transition-requests/:id/approvals`
  is already the shape a signature callback wants; the difference is the actor
- **a frozen artefact to sign.** `frozen_version_id` names the exact issued
  version a signature would be against, and the freeze guarantees it did not move
  between sending and signing
- **a track that is not a person.** `Legal` could become a track whose decision
  arrives from a signing service rather than a user, without the gate learning
  anything new
- **a queue and a status to render.** The approver queue view is the same list an
  "out for signature" state belongs in

**Nothing here is a design decision about Adobe Sign** and none of it should be
built for it now. It is stated so the schema above is not later found to have
foreclosed it.

---

## RULED 2026-08-31 by the business

1. **Opportunity-only scope now.** Test Bed and Contact keep
   `POST /records/:id/transition` and `POST /records/:id/approvals`. **The request
   object stays GENERIC**, keyed to a record rather than to an opportunity, so
   adoption by another record type later is configuration and routing rather than
   a second table. `transition_requests.record_type` is denormalised for the
   trigger and is not a scoping constraint.
2. **The requester may never approve their own request, on any track.** Route
   enforced and asserted. Not a database constraint: `requested_by` and
   `approver_id` are both on rows the route already holds, and a check constraint
   across two tables would need a trigger to express something the route can
   refuse plainly. **The assertion is the control**, and it is calibrated by
   attempting it.
3. **A rejection closes the request.** Approvals already given on other tracks
   are **kept on the closed request as audit** and **do not carry over** to a new
   request. Nothing is deleted; a new request starts with no approvals.
4. **A withdrawal requires a reason**, as a rejection does. `close_reason` is
   required whenever `status` becomes `rejected` or `withdrawn`, and that is a
   table check rather than a route rule.

## RULED 2026-08-31, second panel: BUILD AUTHORIZED

5. **Track approvers are data.** A `track_approvers` table, seeded with John on
   Commercial, Technical and Legal for every opportunity. **Roles per opportunity
   are later work and populate the same table**, which is why `record_id` exists
   on it now and is nullable: null means every record of that type, a value
   scopes the approver to one.
6. **The requester may never approve their own request, on any track. Kept.** The
   walks use a second account as requester; John names it, or the probe account
   is used.
7. **The 882 pre-workflow approvals are history only.** No gate reads them. Open
   opportunities re-approve through a request.
8. **Withdraw is requester-only.** No admin concept is introduced, and the plan's
   earlier "requester or an admin" is superseded by this.
9. **Review requests** record responses with a reason, do not block, are visible
   on the record and in the queue, and are **surfaced to approvers at the next
   transition request**.
10. **The request is the gate's front door.** Unmet exit criteria refuse the
    REQUEST with the blockers list, exactly as Advance does today.

### DEFERRED, NAMED NOW: Delegation of Responsibility

**Recorded before the build starts, on the business's instruction, so it is not
rediscovered as a gap.**

DOR is built **with roles per opportunity, not now**. Its shape when it comes:
**delegation as data** - from track, to person, reason, optional expiry -
with approvals taken under it stamped **"under DOR from X"** in the queue, in the
freeze banner and in the audit trail. **The self-approval rule applies under
delegation**: a delegate who is also the requester still cannot approve.

**The reason for deferring is the reason it is cheap to defer**: with one
approver seeded on all three tracks there is no distinction for the data to
express yet. `track_approvers` is shaped so DOR is a table pointing at it rather
than a second kind of row in it.

---

## Build order, as authorized

1. **the migration**, for John to apply, ask first
2. **the triggers**, with the five-way calibration
3. **the routes**
4. **the client**
5. **the approver seed** (in the migration, verified after it is applied)

**Freeze coverage proven by the sixteen-endpoint test.** Commit and report at
each boundary. **This phase gets its own walk: two sessions, requester and
approver.**

---

## FREEZE COVERAGE, MEASURED. And it corrects this plan in three places

**Not a reading of the plan. Every write endpoint's handler body was parsed
through the comment stripper and its actual table writes extracted**, so a
sentence naming a table cannot be counted as a write and a delegated write
through a helper or an RPC is not missed.

| endpoint | tables it actually writes |
|---|---|
| `PATCH /opportunities/:id` | `record_revisions` |
| `POST /opportunities/:id/close-date-move` | `opportunity_details`, `record_revisions`, `audit_log` |
| `PUT /opportunities/:id/probability-override` | `opportunity_details`, `audit_log` |
| `POST /opportunities/:id/assessment-reviewed` | `record_revisions`, `audit_log` |
| `POST /opportunities/:id/scores` | `record_revisions` |
| `POST /opportunities/:id/key-contacts` | `record_contacts`, **`record_contact_stances`**, `audit_log` |
| `POST /opportunities/:id/key-contacts/:linkId/stance` | **`record_contact_stances`**, `audit_log` |
| `DELETE /opportunities/:id/key-contacts/:linkId` | `record_contacts`, `audit_log` |
| `POST /opportunities/:id/close-lost` | **`records`**, `opportunity_details`, `audit_log` |
| `POST /records/:id/transition` | **`records`**, `opportunity_details`, `audit_log` |
| `POST /records/:id/approvals` | `approvals`, `audit_log` |
| `POST /opportunities/:id/deal-sheet-versions` | **`rpc: insert_deal_sheet_version`**, `audit_log` |
| `POST /deal-sheet-versions/:vid/issue` | `deal_sheet_versions`, `audit_log` |
| `POST /deal-sheet-versions/:vid/restore` | **NOTHING** |
| `POST /deals/submit` | `record_revisions`, `audit_log` |
| `POST /records` | `records`, `record_revisions`, `audit_log` |

### Correction 1: the proposed trigger function has a hole, and it fails OPEN

`record_contact_stances` **has no `record_id` column.** Its columns are
`id, record_contact_id, stance_id, note, created_by, created_at`, and the record
is two joins away through `record_contacts`.

The function in section 2c reads `coalesce(new.record_id, old.record_id)` and
**returns early when that is null**, so on this table it would permit every write
the freeze exists to refuse. **A stance change on a frozen record would go
through and nothing would say so.**

**It fails open, which is the wrong direction**, and it was reachable from two of
the sixteen endpoints. The trigger needs a **per-table resolver** naming how each
table reaches its record, and a table whose resolver is missing must **refuse**
rather than permit.

### Correction 2: `records` has no `record_id` either

Its key is `id`. The same early return applies, so the generic function attached
to `records` would permit `close-lost` to change the status of a frozen record.
**Two of sixteen endpoints, again, and the same fail-open direction.**

### Correction 3: `restore` is a READ and comes off the frozen list

`POST /deal-sheet-versions/:vid/restore` selects a version and returns its
inputs. **It writes nothing**, and the client's own message says so: *"Restored
V1.2. Nothing is saved until you press Save Changes."* Section 3a listed it as
frozen. **What needs freezing is the save it leads to**, which `record_revisions`
already covers.

### And one thing the measurement CONFIRMS rather than corrects

**The version insert goes through an RPC**, `insert_deal_sheet_version`, not a
direct table write. **A trigger on `deal_sheet_versions` fires inside a function
body**, so the coverage holds. **A route-guard approach would have had to know
about the RPC by name**, which is the concrete form of "a route guard is a
declared policy, not an enforcement".

### The revised coverage statement

**Six tables carry opportunity state and each needs its own resolver:**

| table | reaches its record by |
|---|---|
| `record_revisions` | `record_id` |
| `opportunity_details` | `record_id` |
| `deal_sheet_versions` | `record_id` |
| `record_contacts` | `record_id` |
| **`record_contact_stances`** | **`record_contact_id` → `record_contacts.record_id`** |
| **`records`** | **`id`** |

**`approvals` and `audit_log` carry no trigger**, deliberately: they are the
writes the freeze permits.

**The calibration list grows to five**, and the two new ones are the corrections
above: refuse a `record_contact_stances` insert on a frozen record, and refuse a
`records` status update on one.
