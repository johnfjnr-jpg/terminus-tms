# Create-from ownership, Phase 1: report

Tree: 4e7460b. Nothing pushed. Round remains open at Phase 1b.

## What is NOT built, first, per build discipline 15

**The migration is WRITTEN AND UNAPPLIED.** Two of the six ruled paths -
`POST /test-beds/:id/convert` and `POST /contacts/:id/create-opportunity` -
**still admit a non-owner today**, measured live twenty minutes ago, and will
go on doing so until John runs `db push`.

    supabase/migrations/20260908000003_create_from_requires_source_owner.sql

This is the brief's own stop point rather than a shortfall, but it is the
state of the system and it goes first. The environment fact stands
(CLAUDE.md rule 14): this session reaches Postgres only through PostgREST, so
the file **has never been parsed by anything**. The dashboard is its first
parser.

Phase 1b is the remainder: the same probe re-run after the push, expecting
6/6 where it reads 4/6 now.

## The four route guards

Four separate deliberate edits. Each reads the route, widens **that route's
own** source select to fetch `owner_id`, and places the guard where the
ownership question belongs - after the source is loaded and its absence
handled, before anything is consumed.

| file | route | rationale under R5 |
|---|---|---|
| `src/routes/contacts.js` | `create-test-bed` | CONSUMES the contact's identity |
| `src/routes/test-beds.js` | `customer-documents` | CONSUMES the bed's history |
| `src/routes/test-beds.js` | `units/derive` | **INJECTS** into the bed |
| `src/routes/test-beds.js` | `complete-document` | CONSUMES the bed's history |

`contacts.js` uses a shared loader across three routes, so the widened select
is stated as inert for the other two in a comment at the site. Refusal is
`sendRefusal(reply)` throughout: R2 reserves `42501` for RLS-raised refusals,
and a route fabricating one would be claiming a boundary it is not.

### Why this was not a pattern-anchored sweep

**The near-miss is binding here and it is recorded because it nearly
shipped.** The second attempt anchored on the bed-404 line, which is shared,
and inserted the guard into **six** routes including **two GET routes**.
Their selects did not fetch `owner_id`, so `undefined !== request.user.id`
is always true: it would have **refused every caller including owners**, on
read paths, and it parsed cleanly. The suite at that moment would have
passed it.

That is why every calibration below proves BOTH directions, and why the new
test file asserts *exactly the four* ruled paths and *no GET route*.

## The migration

Both function bodies **lifted verbatim** from `20260908000001` rather than
retyped - Verification 20, a second reader of the same value drifts - with
one guard inserted into each, after the `not found` check:

    if v_bed.owner_id is distinct from auth.uid() then
      raise exception '...only its owner can change it.'
        using errcode = '42501';
    end if;

**Architecture 12: derived, never accepted.** The owner comes off the record
the function already loaded. No parameter carries it, so there is nothing for
a caller to assert.

`42501` is correct *here* and not at the routes: inside the function this is
the database refusing, and it maps to 403 through the existing `isRefusal`
path, matching `raise_transition_request` from the write authorization round.

**No self-recording ledger insert**, per Architecture 10 as corrected by the
23505 that rolled back the first push of `20260908000001`.

Verified structurally: 2 functions, 2 guards, 0 ledger inserts, 0 exception
handlers, 9 `insert into public.` preserved against the original.

## Calibration: 6/6, both directions

`scripts/create-from/calibrate-guards.mjs`. It copies `src/routes` and
`scripts/lib` to a temp directory and mutates **the copy**, the test file
being targetable by `CREATE_FROM_ROOT`; `src/routes` is sha256-checked
unchanged at the end (Verification 44 - two harnesses have destroyed the work
they were calibrating).

    DIRECTION ONE: each claim, falsified
      FIRED  the shared loader stops selecting owner_id      (pass 4, fail 1)
      FIRED  a bed select stops fetching owner_id            (pass 4, fail 1)
      FIRED  a guard is removed                              (pass 4, fail 1)
      FIRED  THE NEAR-MISS: a GET route gains the guard      (pass 3, fail 2)
      FIRED  R7: a sweep guards the exempt approvals path    (pass 4, fail 1)
    DIRECTION TWO: the untouched tree is green
      FIRED  the untouched sources pass                      (pass 5, fail 0)
    src/routes unchanged by the harness: true
    6/6 calibrations behaved as required

The near-miss injection is the reproduction of the real fault, and R7's is
the exemption made to fail on purpose: **no later sweep may close the
approvals path**, and now a sweep that tries fails a test by name.

**A harness fault found and removed:** a sixth entry, a "no-op control",
whose `from` and `to` were identical and whose anchor text did not exist in
the file. It reported `STOP: anchor missing`. That was my harness, not a
finding, and the untouched-sources run is the real direction-two control.

## Live proof: four of six, both directions

`scripts/create-from/probe-source-owned.mjs`. Server restarted first - the
routes changed after it started (build discipline 9).

| path | owner | non-owner | verdict |
|---|---|---|---|
| `POST /test-beds/:id/customer-documents` | 201 | **403** | both directions |
| `POST /test-beds/:id/complete-document` | 201 | **403** | both directions |
| `POST /test-beds/:id/units/derive` | 200 | **403** | both directions |
| `POST /contacts/:id/create-test-bed` | 201 | **403** | both directions |
| `POST /test-beds/:id/convert` | 201 | 201 | **STILL LANDS** |
| `POST /contacts/:id/create-opportunity` | 201 | 201 | **STILL LANDS** |

**The owner column is not decoration.** The reverted guard would have scored
a perfect six on any refusal-only check while locking every owner out, so a
403 without a 201 beside it is worth nothing on this round.

Refusals are asserted **ownership-shaped**, not merely 4xx: the probe matches
the refusal text, because identical inputs can draw a no-change or gate
refusal before ownership is ever asked. That exact mistake cost the write
authorization round two rebuilds.

## The route tests

`scripts/tests/create-from-ownership.test.mjs`, five tests, wired into
`package.json`, **derived from the brief and not from the code changed**:

1. exactly the four ruled paths carry the guard - by name, not by count
2. **no GET route carries it** - the near-miss, as an assertion
3. every guarded route can actually READ an owner (follows the shared loader
   for the contacts route rather than assuming an inline select)
4. refusal goes through `sendRefusal`, never a fabricated `42501`
5. **R7: the approvals path is exempt and must stay unguarded**

Test 3 exists because the near-miss's fatal half was not the placement, it
was guarding a route whose select could not answer the question.

Suite: **498/498**, emitted by the run.

## Evidence footprint

Enumerated from a **tag in the database**, not from a file the harness wrote
(Verification 11): 29 live records under `cf1b-r0` - 12 accounts, 9 test
beds, 4 contacts, 4 opportunities - of which 6 were handed to the probe
account. Nothing soft-deleted yet.

The two non-owner conversions that landed are among these four:
`29e4d508`, `41313fc3`, `a0f85663`, `ebd91a9b`. Teardown is proposed at the
close as a counted change, alongside the probe round's kept R7 evidence.

## Observation, recorded and not chased

The tagged sources owned by the probe account carry **zero `audit_log`
rows**, where the brief's defect statement says a non-owner conversion makes
the source's audit history gain a row. That claim came from the probe round's
measurement and may be attributed to the new record rather than the source.
It changes nothing about this round's fix - the allowance and the reference
code are consumed regardless - so under rule 10 it is recorded and queued
rather than opened here.

## What this does NOT establish

- **Nothing about the two function paths.** Their guard has never been
  executed by anything.
- Nothing about the migration's syntax. It is unparsed.
- The four route guards are proven on live HTTP; their behaviour under
  concurrent access is not measured and was not claimed.
- The gate has not been run on this tree; that is Phase 2.

## Stop

Phase 1 is at its stop point. Awaiting sign-off and John's `db push` of
`20260908000003`, after which Phase 1b re-runs the probe expecting 6/6.
Nothing pushes.
