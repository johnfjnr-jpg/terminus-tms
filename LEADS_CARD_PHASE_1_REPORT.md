# Phase 1: the conversion spine, and R6

**Read this section first: two migrations are WRITTEN AND UNAPPLIED.**
Their proofs are Phase 1b and cannot run until John applies them. R6 is
complete and proven. Card work (R2) is a later phase. Lead Detail is
untouched (R4). Nothing pushed.

---

## 1. NOT BUILT YET, and why

| item | state |
|---|---|
| `qualify_contact` atomic function | **written, unapplied** |
| Qualify gate supersession | **written, unapplied** |
| atomicity proofs, failure injected at each step | **Phase 1b**, needs the function applied |
| R8 cancel-leaves-nothing proof | **Phase 1b**, same reason |
| the 14 = 8 + 5 + 1 proof | **Phase 1b**, same reason |
| R2 card work | later phase, by instruction |

This session reaches Postgres only through PostgREST: **no `psql`, no
`pg` module, no connection string.** A migration written here **cannot be
parse-checked before it is handed over**, and saying so is part of
handing one over.

**That is not theoretical this time.** The gate migration's self-check
was written against a column called `rule_type`. Measured against the
live table, the column is **`requirement_type`**. Corrected before
handover. Had it gone over as drafted it would have failed in John's SQL
editor, which is the first parser it meets.

---

## 2. The migrations, for John to apply

**Apply through the Supabase SQL editor**, not `db push` - the ledger
does not track the files on disk and a push would treat them all as
pending.

### File 1, first

`supabase/migrations/20260912000001_qualify_is_one_transaction.sql`

Creates `public.qualify_contact(uuid, uuid, text, jsonb, text)`.

### File 2, second

`supabase/migrations/20260912000002_qualify_drops_account_precondition.sql`

Deletes the one `parent_record_id` row from the Qualify gate and
self-checks **both directions**: zero `parent_record_id` rows remaining,
and exactly 14 rules left. It raises rather than passing quietly if
either is wrong.

### Then record the ledger rows, as a SEPARATE statement

Architecture 10 as corrected: **a migration must not write its own ledger
row.** The file's `on conflict` protects the file's own insert and cannot
protect the CLI's, so under `db push` it is the CLI's insert that
collides and the whole migration rolls back. Applying by hand does not
write the row at all, so it is recorded separately, after the apply:

```sql
insert into supabase_migrations.schema_migrations (version)
values ('20260912000001'), ('20260912000002')
on conflict (version) do nothing;
```

### What the function does, and what it deliberately does not

Derived from `create_opportunity_from_contact`: `plpgsql`,
`security invoker`, identity from `auth.uid()`, **ownership derived from
the record and never accepted as a parameter** (Architecture 12), the
ownership check before every other check so a non-owner learns nothing
about the record's state from the refusal's shape.

In one transaction: create or link the Account, link the lead to it via
`parent_record_id`, flip status to Qualified, append the contact's next
revision carrying its payload forward, write two audit rows.

**IT DOES NOT EVALUATE THE COMPLETENESS GATE.** `computeBlocking` is the
single evaluator and `POST /records/:id/transition` already calls it
server-side, measured. A second implementation inside the function would
be Verification 43 exactly - a writer beside a correct rule, agreeing
today and drifting later. **The caller runs the gate; the function runs
the transaction.**

### "Create Contact" resolved by measurement, not assumption

R1 says *create/link Account, create Contact, flip status*. There is **no
second record**:

- there are **no live `lead` records**; `record_type='lead'` serves
  legacy rows deliberately left alone;
- a Lead **is** a `contact` row at status Unqualified, stages
  `Unqualified -> Qualified -> Nurture`;
- `frontend/index.html:107` states the design of record: **"one record,
  one stage chip, no separate Lead conversion."**

So the Contact is **made by the status flip on the same row.** Creating
one would contradict the LEADS round's own design. Recorded rather than
asked, because a settled question is not an ambiguity.

### The supersession, measured before writing

The `Unqualified -> Qualified` gate carries **15** rules, all
`variant` null, all `payload_field_required`, with **exactly one**
`parent_record_id` row. Removing it leaves 14:

| group | count |
|---|---|
| Contact Details: name, company, jobRole, email, mobile, industry_id, source, linkedin | 8 |
| Address Details: address, city, postcode, country, region | 5 |
| Summary | 1 |

**14.** R1's gate is the current gate minus one row.

---

## 3. R6: the grid owns its dirty state. Complete and proven.

`scripts/leads-card/probe-grid-dirty.mjs`, **4/4 on the live screen**
after rebuild, bundle freshness asserted first.

| case | result |
|---|---|
| a clean grid does NOT warn | dialogue `false` |
| a genuinely dirty grid DOES warn | dialogue `true` |
| a SAVED, clean grid does NOT warn | "1 lead created.", grid "0 ready", dialogue `false` |
| a PARTIAL save leaves it dirty and it DOES warn | "1 ready, 1 to correct" then 1 invalid row kept, dialogue `true` |

**Cases 1 and 2 are the calibration, in the same run.** The guard is
shown not firing on a clean grid and firing on a dirty one, so case 3's
`false` is a reading rather than a default, and case 4's `true` is not a
guard that always fires.

### What changed

The shell's two inference listeners are **gone**, superseded in place
with the reasoning visible:

```js
//   .addEventListener('input',  () => { newLeadDirty = true })
//   .addEventListener('change', () => { newLeadDirty = true })
```

They inferred dirty from any keystroke in the panel. **That inference
cannot see a save** - John's screenshot - and **cannot see a partial
save** either. The grid computes `filled.length > 0` and reports it
through `onDirtyChange`; the shell publishes `window.setNewLeadDirty` and
stops guessing.

**Case 4 is why R6 rejected the one-line reset, and it is now
demonstrated rather than argued.** A reset wired to `onDone` fires after
a partial save too, and would have cleared the flag while a person's
unsaved invalid row was still on screen - losing work on the next
navigation, silently.

Suites after the change: pure **519/519**, react **939/939**.

---

## 4. R9, confirmed with specifics

John's direction is confirmed: a minimum sensible width per column, the
panel scrolling horizontally, so nothing is crushed at fifteen columns.

Specified rather than left as an adjective, for the phase that builds it:

| column group | min width |
|---|---|
| name, company, email | 180px |
| summary | 220px |
| industry, source (selects) | 160px |
| jobRole, mobile, linkedin, city, country, region | 150px |
| address, address2 | 200px |
| postcode | 110px |

Roughly 2,300px of content inside a panel capped at
`min(1480px, 96vw)`, so the existing horizontal scroll carries it. **The
grid is already its own scroll container**, so R3's shape needs sizing,
not restructuring.

---

## 5. R10 recorded, not built

**The question:** should a round-close refuse a run where required
stages did not run? Today only the door stage is marked `required`, so a
close with a dead session exits 0 while honestly reporting "14 NOT RUN".

**The recommendation is YES, and the reasoning is F6's own, one level
up.** F6 established that an unanswered stage is not a passed one. A
close resting on fourteen unrun stages has measured nothing about
fourteen stages, and reporting that honestly while still exiting 0 leaves
the decision to whoever reads the line - which is exactly the position
F6 removed for the door stage.

**It is cheap, because the mechanism already exists**: mark the stages
`required`. And it costs nothing on ordinary runs, because `--round-close`
is already opt-in.

**Not built here, by instruction.** It touches every close and
calibrates on its own.

---

## 6. What this phase does not establish

- **The function has never run.** Everything in section 2 is derived from
  a proven precedent and read against the live schema. It is not
  evidence that it executes, that it rolls back, or that it survives the
  triggers already on `records` - Verification 46: a new writer inherits
  every guard on the table whether or not they were written for it. That
  is Phase 1b's first measurement.
- **No route calls it yet.** The card's Qualify, the `LinkAccountPanel`
  reuse (R7) and the cancel path (R8) are unbuilt.
- R6's proof drove one account on one browser. The four cases are
  mechanism-level and deterministic; they are not a walk.
