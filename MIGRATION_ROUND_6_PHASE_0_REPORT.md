# Migration Round 6, Phase 0: the estClose fix, then Contact investigation

Session of 2026-09-07.

---

## WHAT IS NOT DONE, FIRST

### 1. THE SESSION IS DEAD, AND TWO ITEMS ARE BLOCKED ON IT

**`session-ref.json`'s refresh token is expired, and recovery needs a password
this session cannot supply.** `refresh-session.js` refuses; `sign-in.js` reads
the password from a masked prompt or `TMS_TEST_PASSWORD`, and that variable is
not in `.env` (checked for presence, not read).

This is Verification 25's corollary arriving exactly as written: the recovery
path's own prerequisite is the thing that has expired.

**What it blocks, precisely:**

| item | state |
|---|---|
| 1c, the live save round-trip and the reason-required branch walked | **BLOCKED.** `scripts/round6/walk-close-date.mjs` is written and unrun |
| 2.2, the census's SECOND instrument on an initialised exercised record | **BLOCKED.** The source instrument is complete; the DOM one needs a browser session |
| the gate's 14 HTTP stages, and the session precondition | **BLOCKED** |

**To unblock, John:**

```bash
node --env-file=.env scripts/sign-in.js <your email>
```

Then `node scripts/round6/walk-close-date.mjs` and `npm run verify`.

**What is NOT blocked, and is done:** the whole of item 1 except its live half
(the contract, the build, the jsdom suite, the 7/7 injection sweep, the
re-point and the retirement), and seven of Contact Phase 0's eight items in
full plus half of the eighth.

### 2. The live calibration is the half that matters most, and it is honest to say so

The write path is proven by **jsdom and by injection**, not by a browser. The
defect it fixes was invisible to 550 jsdom tests for a round. The walk is
written to close exactly that gap and has not run.

---

## ITEM 1: THE EST. CLOSE DATE WRITE PATH

### 1a. The contract, measured

**The route.** `POST /api/opportunities/:id/close-date-move`, body
`{date, reason?}`. It is the ONLY writer of
`opportunity_details.forecast_close_date`; a second write path would be the
fork Architecture 1 forbids.

**Seven refusals, in the order they fire:**

| # | status | message |
|---|---|---|
| 1 | 400 | `date is required` |
| 2 | 400 | `date must be a valid date (YYYY-MM-DD)` |
| 3 | 400 | `date cannot be in the past` |
| 4 | 404 | `not found` |
| 5 | 400 | `Est. Go Live cannot be before Est. Close Date` |
| 6 | 400 | `date is unchanged` |
| 7 | 400 | `reason is required`, **only when `closeDateNeedsReason`** |

**The predicate.** `closeDateChangeKind(stored, next)` answers `initial`,
`move` or `unchanged`; `closeDateNeedsReason` is `kind === 'move'`. `unchanged`
is its own answer rather than folded into `move`, because the route refuses it
with a different message and a caller treating it as a move would ask for a
reason before finding that out.

**What the vanilla sent.** estClose was pulled out of the batch first. A move
opened the shared reason dialogue and POSTed with the reason; a first recording
POSTed without one and showed refusals on the surface feedback, because no
dialogue is open on that path. Either way the remaining dirty fields were saved
in the same action.

### 1b. The path, built to that contract

`estClose` is taken out of `changes` before the payload is assembled and saved
through its own route; `savePayload` then runs for the rest. The
`if (k === 'estClose') continue` that discarded it is gone, with the reasoning
recorded at the site.

**Two seam decisions, both departures from the vanilla and both improvements:**

**The predicate is imported directly** from `src/lib/opportunity-dates.js`,
which is the same file the route imports. The vanilla read it off a
`window.closeDateNeedsReason` bridge because a classic script cannot import.
There is now no third party between the screen and the server.

**The dialogue is REUSED, not rebuilt.** It owns the focus trap, the single
Escape owner, the backdrop-click cancel and the stays-open-on-failure
behaviour. A React copy would be a second place for all four to drift. It
reaches the tree through `shell-services.ts`, the only module allowed to read
`window`, and it **throws when absent** rather than resolving to undefined: a
missing dialogue means the person is never asked for the reason the route then
demands, and the save fails with `reason is required` for no visible cause.

`EditBar` gained an optional `saveId` so the surface can name its own Save
control for focus return. A prop rather than a constant, because the bar is
shared and a fixed id would be a duplicate the moment two surfaces render.

### 1c. Calibration

**7/7 detected**, reverted run green, `ReferenceHost.tsx` byte-identical.
`scripts/round6/inject-phase-0.mjs`, verified-snapshot harness.

| injection | fires |
|---|---|
| the date is dropped again, as it was before this phase | 8 tests |
| a reason is demanded for a FIRST recording | 2 |
| a MOVE is written with no reason asked | 6 |
| the rest of the save is forgotten after the date | 1 |
| cancel discards the rest of the edits | 1 |
| the date is written before the reason is given | 4 |
| a refused first recording is swallowed | 1 |

**AND THE FIXTURE WAS WRONG FIRST, caught by calibration rather than by
reading.** The no-stored-date fixture was defeated because the host reloads on
mount and the api stub answered with the same record every time, so `stored`
was never null and the first-recording branch was unreachable. Verification 47.

**AND H5 LOST ITS VACUOUS GUARD**, which is why this defect survived a round
under a test written to catch it. It read:

```js
if (patches.length) { /* assert estClose is not in the payload */ }
```

With estClose the only dirty field the host sent **nothing at all**, so the
loop never ran and the assertion passed on an empty body. True by absence,
Verification 14. It now asserts the positive as well: the key is absent from
the payload BECAUSE it went to its own route.

**The live half is unrun.** See the top of this report.

### 1d. The re-point and the retirement

`opportunity-dates.test.mjs`'s screen half now reads `ReferenceHost.tsx`. Its
neighbouring assertion inverted: it demanded the window bridge exist, and now
demands it does NOT, because the bridge had one reader and lost it.

**`frontend/opportunity-reference.js`, 1,055 lines, retired.** Sized by sandbox
deletion at **zero** failing tests. Deleted with it: five Round 5 instruments
and `reference-coupling.test.mjs`.

**Two claims, verified with the stripper.** The browser does not load it; two
mentions survive, both disposed - prose inside a template literal in
`test-bed-detail.js`, and `live-form.test.mjs` naming it to assert it does not
exist.

**A DISCREPANCY WITH THE INSTRUCTION, recorded rather than smoothed over.** The
instruction expected the ledger to close "by its own calibration", as the deal
form's did in Phase R. **It could not.** That calibration is
`assert.ok(found.length > 0)`, and two ledgered mentions survive the file, so
it reads 2 and passes. The ledger was retired by its own recorded disposition
instead - *"THIS FILE. It names the surface because it is the ledger"* - and
both survivors are disposed above.

**THE BRIDGE BLOCK, AND THE MISTAKE I NEARLY SHIPPED.** The inline script
published four names on `window`. Three had `opportunity-reference.js` as their
only reader - `toNumberOrNull`, `WRITABLE_NUMERIC_KEYS`, `closeDateNeedsReason`
- measured across the repository, and the React tree imports those modules
directly. **The fourth did not.** `usesWorkflow` is read twice in `app.js`, at
the two sites deciding whether the superseded approve control applies to a
record type. My first edit deleted the whole block and would have left that
control reading `undefined`.

**It was caught by the strip-comments corpus firing on the inline-script
count** - an instrument that fired for a reason unrelated to the damage.

---

## ITEM 2: CONTACT PHASE 0

`frontend/contact-detail.js`, 1,327 lines. Markup `index.html:435-647`, 213
lines, 45 static `cd-*` ids.

### 2.1 The view boundary

**`loadContactDetail`** wraps `loadContactDetailInner` in try/finally so every
exit clears the loading flag, including the two early returns.

**`cdReturnView`** is `let`, set at render to `contacts` when the contact is
Qualified and `leads` otherwise, and read by `navigate(cdReturnView)`.

**FINDING C1: `app.js:306` READS IT, AND A BUNDLE CANNOT PROVIDE IT.**

```js
document.getElementById('btn-back-contact-detail')
  .addEventListener('click', () => navigate(cdReturnView))
```

`let` at the top level of a classic script shares the global lexical scope with
other classic scripts, so `app.js` can read it today. A bundle cannot: the name
never reaches `window`. **This binding is registered at load**, so migrating
the file breaks the back button rather than degrading it.

**And a naive scan over-reported by three.** `cdEdits`, `cdNoteOpen` and
`cdParkKeydownHandler` also appeared in `app.js` - all three in COMMENTS.
Verification 39: strip before matching. The real count is one.

**The declaration-keyword split** (Migration Round 2's queued rule):

| | count |
|---|---|
| reachable from a bundle (`function`) | **39** |
| unreachable (`let`/`const`) | **22** |

**Every piece of state and the entire field census is in the unreachable set** -
`CD_ALL_FIELDS`, `CD_CONTACT_FIELDS`, `CD_ADDRESS_FIELDS`, `cdPayload`,
`cdEdits`, `cdLoadedRevision`. The React panel must derive descriptors from the
census and hold its own state, exactly as Round 5's did.

**Inline handlers: 10.** Eight declared in `contact-detail.js` as `window.X =`;
two from the shell, `createFromContact` and `fieldDisplayKeydown`.

### 2.2 The field census

**Instrument one, the source: 15 fields.**

| group | fields | editor |
|---|---|---|
| `CD_NAME_FIELD` | name | text, **static markup** |
| `CD_CONTACT_FIELDS` | company, jobRole, email, mobile, linkedin | text |
| `CD_COLUMN_FIELDS` | industry | **lookup select, ID-valued** |
| `CD_SOURCE_FIELD` | source | select, 5 static options |
| `CD_ADDRESS_FIELDS` | address, address2, city, postcode, country, region | text x5, select x1 |
| `CD_SUMMARY_FIELD` | summary | text, **static markup** |

**Three editor kinds, not two.** `cdFieldRow` emits text or select; `industry`
goes through `cdColumnFieldRow`, whose **value is an ID and whose display is a
resolved name** from `industriesCache`.

**Two static-markup bypasses**, `name` and `summary`, populated by id rather
than rendered - the same shape the Reference tab had, and both use the `hidden`
CLASS rather than the attribute.

**`industriesCache` is `let` in `app.js:5065`**, so a bundle cannot read it.
Round 5's ruling applies: the panel fetches its own.

**Instrument two is BLOCKED** (no session). The static markup was read as a
partial second source and agrees on the two bypasses and the two row
containers, but a census taken on markup that has not initialised, computed or
been exercised is exactly what Verification 49 forbids reporting as a census.

### 2.3 The Qualify workflow

**15 contact rules in `stage_gate_rules`, read from the live database.** 14
gate `Unqualified -> Qualified`; 1 gates `Unqualified -> Parked`
(`followUpDate`). All are `payload_field_required`, and none carries the
`min_length` or `entry_stage_at_or_after` clauses the server's evaluator also
supports.

**The `blocking[]` lifecycle:**

| moment | what happens |
|---|---|
| set | `attemptContactQualifyFromDetail` on a **422** with `data.blocking` |
| rendered | `.field-blocked` on `[data-key]`, plus the Account card for `parent_record_id` |
| cleared per field | `refreshCdBlockedFields` drops entries whose value is no longer `undefined`/`null`/`''`, against the reloaded record - **never by re-attempting the transition**, which would qualify the contact as a side effect of saving a field |
| cleared wholly | on a successful qualify, and when the view loads a different contact |
| re-applied | on every render, from whatever list is already known |

**FINDING C2, AND IT IS LIVE ON THE VANILLA: the Industry row is never tinted
when it blocks.** The gate names the field `industry_id`; the row carries
`data-key="industry"`; `renderCdBlockedFields` does
`querySelector('[data-key="${b.field}"]')`. **No element carries
`data-key="industry_id"`.**

Checked across all 14 gated fields: **13 land, 1 does not, and it is this one.**
`parent_record_id` is handled specially and correctly. The clearing logic
handles `industry_id` fine - it is only the render that misses - so a person
blocked on Industry is told the transition failed and shown nothing.

**FINDING C3: `refreshCdBlockedFields` is a second reader of the server's
rule**, and says so in its own comment: *"the exact same ... rule
transitions.js's payload_field_required check uses"*. Verification 20's
signature phrase.

Measured, **they agree today**: the server's base test is
`!(value === undefined || value === null || value === '')` and the client's is
identical. The server's three extra clauses do not apply because no contact
rule carries them. Likewise `cdBlockingFieldValue` hardcodes two record columns
where the server's `RECORD_COLUMN_FIELDS` holds **three** -
`installer_account_id` is unused by any contact rule. Architecture 8 exactly:
correct for every caller that exists.

### 2.4 The link-account panel

`POST /api/contacts/:id/link-account` with `{account_id}` or
`{new_account_name, account_details?}`.

**The in-flight guard holds, measured rather than assumed.**
`performLinkCdAccount` sets `cdLinkInFlight = true` **synchronously as its first
statement**, before any await, so a second click in the same tick is refused.
It is not the Round 4 shape, where the flag was set after an await and the
guard could not fire in either direction. Buttons are disabled as a second
guard.

**The one gap:** the dirty-edits path calls `openDiscardConfirm(...)` and
returns **without** setting the flag, so two rapid clicks while dirty both open
the dialog. Benign today (the dialog replaces itself); named so Phase 1 does
not reproduce it.

### 2.5 The save path

`PATCH /api/contacts/:id` with `{payload, industry_id?, expected_revision}`.

- **Only-dirty**, plus notes, plus `industry_id` lifted to the top level
  because it is a real column.
- **One note per save session**, not one per field: every change sentence
  joined into a single Notes History entry, prepended to the existing list.
- **The revision handshake** is `expected_revision: cdLoadedRevision`.
- **409 carries a hardcoded sentence**, where the Reference tab uses the
  shell's `staleWriteHtml` renderer. A divergence to settle in Phase 1: two
  descriptions of one event, and only one of them carries the reload control.

**`CONTACT_WRITABLE_KEYS` against the census:** aligned, with three keys
writable that are not census rows - `notes` (the history), `followUpDate` (the
Park form) and **`legalEntity`, which is rendered NOWHERE in the frontend.** A
writable key with no editor, recorded rather than acted on.

### 2.6 Coupled tests, strings, and the retirement sizing

**Sized by sandbox deletion: ONE failing test.**
`class-rules.test.mjs` :: *every declared state class is actually toggled, and
carries no rule*.

**The strings scan, both ways:**

| | count | files |
|---|---|---|
| code mentions | **3** | `index.html` (the tag), `enumerate-retirement.mjs` (its re-pointed default target), `class-rules.test.mjs` |
| prose-only | **5** | `app.js`, `style.css`, `test-bed-detail.js`, `src/routes/accounts.js`, `src/routes/contacts.js` |

The five prose mentions are Verification 41's strings clause: nothing can catch
them, and each needs a disposition at retirement.

### 2.7 The door

**Contact has no ownership read at all.** Zero occurrences of `is-not-mine`,
`owner_id` or `canEditFields` in `contact-detail.js`, and `app.js`'s sweep
touches only `view-test-bed-detail` and `view-opportunity-detail`.

**So the Account preserve ruling applies by precedent**, as the brief
anticipated: `CAN_EDIT_BY_VIEW` gains `'contact-detail': () => true` in the
swap commit. Recorded for John to overrule if leads carry different ownership
semantics.

### 2.8 Editor-slot fit

**One gap, and it is the Industry row.**

The proven layers are text, select, date, textarea and checkbox. `FieldRow`'s
descriptor declares `options?: string[]`, so **value and label are the same
string**. Industry needs `{id, name}` pairs: the value written is an ID and the
display is a resolved name.

Both halves of the row need it - the editor to offer name-labelled options with
ID values, and the display half to resolve an ID to a name rather than printing
the ID. Named before Phase 1, as the brief requires.

---

## Findings, collected

| # | finding | severity |
|---|---|---|
| C1 | `app.js:306` reads `cdReturnView`, a `let` a bundle cannot provide. Registered at load | blocks Phase 2 |
| C2 | The Industry row is never tinted when it blocks Qualify: gate says `industry_id`, row says `industry` | **live defect** |
| C3 | `refreshCdBlockedFields` duplicates the server's emptiness rule; agrees today, by construction | watch |
| C4 | `legalEntity` is writable by the route and rendered nowhere | tidy |
| C5 | Contact's 409 uses a hardcoded sentence where Reference uses the shell renderer | Phase 1 |
| C6 | The link panel's dirty path returns without setting the in-flight flag | Phase 1 |
| C7 | The select editor cannot express an ID-valued lookup | Phase 1, blocking Industry |

**None of these stops the round.** C2 is live and pre-existing, so under
build-discipline rule 10 it goes on the list; it is on the surface Phase 1
rebuilds, so it will be fixed by the rebuild rather than as a separate item.

---

## Gate

**NOT GREEN, and it cannot be from this session.** Run on `912ad8a`:

```
MERGE GATE  main  912ad8aba4a68c639621803ce53e9ee779eb28dc
  PASS  reachability            exit 0    101ms
  FAIL  session precondition    exit 1    621ms
  PASS  pure suite              exit 0   4157ms  452/452 pass, 0 fail
  PASS  react typecheck         exit 0    602ms
  PASS  react suite             exit 0   8430ms  480/480 pass, 0 fail
  PASS  react bundle freshness  exit 0    663ms
1 of 21 stages FAILED, 15 NOT RUN.
```

**Every stage that can run without a live session passed**: 452/452 pure,
480/480 react, typecheck clean, bundle fresh. **The one failure is the dead
session, not the work**, and the gate says so itself in its closing line -
*"Nothing was measured by the skipped stages. They are not findings."*
Verification 48 encoded in the harness rather than left to a reader.

The 15 skipped include the database suite and all 14 HTTP probes.

Transcript: `.verify/verify-1186716737919625.txt`

**To finish the gate, John:** `node --env-file=.env scripts/sign-in.js <your
email>`, then `npm run verify`. The same sign-in unblocks
`scripts/round6/walk-close-date.mjs` and the census's second instrument.

**Not pushed. Phase 1 not started.**
