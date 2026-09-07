# Migration Round 7, Phase 0: Test Bed investigation

Session of 2026-09-07. **Investigation only. No product code.** Two instruments
were built - the accounting and its parser - because item 1 asks for them.

---

## STOP: A LIVE DEFECT ON THE SURFACE ABOUT TO BE MIGRATED

**Saving a field edit on the Test Bed detail screen throws, saves nothing, and
says nothing.** It has done since Round 38.

```
frontend/test-bed-detail.js:2732
  const result = await tbPatch({ payload: payloadUpdate })
```

**`payloadUpdate` is declared nowhere.** Measured across the whole repository
with comments stripped: it appears **once**, at that use. `contact-detail.js`
has its own, but it is function-local and does not leak. `app.js` has none.

**`git log -S` puts its removal in `38df3db`, "Round 38: the precondition is
required, and three checks become one"** - the commit whose own comment, four
lines above, explains that a per-field check was replaced by a record-level
precondition. The replacement removed the payload construction with it.

**Measured live, not inferred:**

```
field opened: true
errors during save: [ "PAGEERROR: payloadUpdate is not defined" ]
feedback shown: ""
```

The feedback element is left **empty**, so a person sees a Save click do
nothing at all - no error, no confirmation, no change.

**Why nothing caught it.** Nothing in the repository POSTs a Test Bed field
save: `npm run verify` is green on this tree, and the surface's own coupled
tests read source shapes rather than exercising the path. This is Verification
40's instance exactly - *"the only scoring write in the system had never been
executed by anything but a human being"* - on a different write, three rounds
later.

**Why it stops the round.** Phase 1 must know whether it is porting the
behaviour as written or as intended, and the two differ. **This is not mine to
decide**: it is a live defect on the business's largest surface, and fixing it
is scope beyond the brief. The report is the deliverable.

**The fix is small** - reconstruct the payload from the dirty entries, as
`saveCdFields` and `performGenericRefSave` both do - but *which* keys is a
question about `TEST_BED_WRITABLE_KEYS` and the two server-computed fields
below, and that is a decision rather than a repair.

---

## 1. The accounting instrument, first

`scripts/tests/test-bed-accounting.test.mjs`, with the parser split into
`scripts/lib/top-level-names.mjs` so one parser serves every surface.

**136 top-level names**, all claimed by **20 enumerated capabilities**, none
unmapped.

| form | count |
|---|---|
| `function` | 65 |
| `const` | 25 |
| `window.X =` | **25** |
| `let` | 21 |

### The instrument built in Round 6 missed one on the very next surface

The brief says 25 window globals. The Round 6 parser found **24**, because its
window branch was anchored on `function`:

```js
window.toggleExitCriterion = (field, isMet) => { ... }
```

An arrow, not a `function`. **And `app.js` carries THIRTEEN more of the same
form**, so the shell inventory recorded at Round 6's close is undercounted by
thirteen.

The window branch no longer asks what is being assigned. **Any `window.X = ...`
at line start is a global.**

**Calibrated four ways**, each restored byte-identical: a new unmapped name
fires; a new unmapped **arrow** global fires; re-anchoring the parser on the
keyword fires two tests; a map entry naming something absent fires.

### The capability list - this surface's scope

| | capability |
|---|---|
| 1 | view-lifecycle |
| 2 | field-rows |
| 3 | save-path |
| 4 | **cost-preview** |
| 5 | date-bounds |
| 6 | validation |
| 7 | notes-history |
| 8 | revision-history |
| 9 | site-details |
| 10 | commercials |
| 11 | install-section |
| 12 | installer |
| 13 | tech-team |
| 14 | customer-documents |
| 15 | sensor-counts |
| 16 | use-cases |
| 17 | buyer-roles |
| 18 | exit-criteria |
| 19 | **scoring** (24 names, the largest) |
| 20 | **units** (11 names) |

**Twenty capabilities against Contact's eleven, on 2.5x the lines.** Scoring
and units alone are 35 names - more than a third of Contact's entire surface.

---

## 2. The field census, two instruments

**Instrument one, the source: 30 declared** in `TB_ALL_EDITABLE_FIELDS`.

| group | fields |
|---|---|
| `TB_NAME_FIELD` | 1 |
| `TB_TERMINUS_FIELDS` | 6 |
| `TB_CUSTOMER_FIELDS` | 1 |
| `TB_SITE_FIELDS` | 6 |
| `TB_SENSOR_COUNT_FIELDS` | 3 |
| `TB_DATE_FIELDS` | 3 |
| **`TB_INSTALL_FIELDS`** | **0 - an empty group in the union** |
| `TB_COST_FIELDS` | 9 |
| `TB_SUMMARY_FIELD` | 1 |

**The brief says nine groups. Eight are populated and the ninth is empty.**

**Instrument two, the DOM, on an initialised exercised record: 34 rows**, and
they are **constant across all 13 sub-tabs**.

### The reconciliation

| | |
|---|---|
| declared | 30 |
| **less** `estCostPerUnit`, `indicativeCost` - declared but never rendered | -2 |
| **plus** three `buyer-*` rows, `installer`, `techTeam` | +5 |
| **plus** one row with an **EMPTY** `data-key` | +1 |
| DOM | **34** |

**The two unrendered fields are DELIBERATE and documented**: Round 5 Phase 6
made them server-computed and removed them from `TEST_BED_WRITABLE_KEYS`, and
the file's own comment says rendering them *"would put two editable fields on
screen whose every save the server rejects."* They stay in the array because it
is still the batched-save list.

**That is a hazard for Phase 1, and it is the reason the accounting runs first.**
`TB_ALL_EDITABLE_FIELDS` is not the render list. A migration that treats the
declaration as the census creates two rows the server refuses.

**One row carries an empty `data-key`** - measured, not inferred. `tbFieldRow`
emits `data-key="${key}"`, so a caller passes an empty key. Named for Phase 1.

**Editor kinds: FOUR, all proven** - text, select, date, textarea. Plus the
buyer rows, which are **lookups**: `<option value="${c.id}">${name}</option>`,
id-valued and name-labelled, exactly the shape Round 6's A8-A11 built.

**Read-only rows: 6**, and **they carry no `data-key` at all** -
`tbReadonlyRow` emits `.ref-field-display.readonly` and nothing else. A
`[data-key]` census cannot see them, which is why the first pass read zero.
Verification 49's own clause: the criterion has a shape.

**No dangling `label[for]` or `aria-*` targets.**

### What the tabs do and do not change

**13 sub-tabs** - ten stage tabs and three Reference sub-tabs. The **field rows
do not vary**; the **id surface does**, 183 to 192 per tab, **union 211**. The
per-tab content is the scoring and exit-criteria machinery, which the accounting
already carries as capabilities 18 and 19.

---

## 3. The door

**`app.js:6520`:**

```js
const notMine = !!currentTestBed.owner_id && !!currentSession?.user?.id
  && currentTestBed.owner_id !== currentSession.user.id
```

**Byte-for-byte the same derivation as the Opportunity sweep at `:8049`**, which
is the good case: one rule, two call sites, no drift.

**It fails OPEN on absent ownership.** A record with no `owner_id`, or a session
with no user id, yields `notMine === false` - the record reads as mine. The
file's own comment says this is *"NOT A SECURITY BOUNDARY... RLS is the
boundary"*, so the direction is deliberate; it is recorded because a migration
must reproduce it rather than tighten it silently.

**Readers of `is-not-mine` for this view:** the sweep at `:6520` writes it; the
registry helper at `:197` reads it; and `style.css:5352-5370` carries **six
rules** that dim inputs, displays, switches and buttons.

**`CAN_EDIT_BY_VIEW` has NO `test-bed-detail` line.** The seam fails closed, so
a swapped surface refuses every row until the swap commit adds it - the same
sequencing the Reference tab and Contact both used.

**Both directions live: NOT MEASURED THIS PHASE.** The not-owned fixture by
admin write is the Round 4 pattern and nothing blocks it, but the surface's
save is broken (above), so a door measurement would be measuring a refusal
against a path that throws anyway. **It belongs immediately after that decision
and before Phase 1.**

---

## 4. The cost preview, as behaviours

**C1. Thirteen keys trigger it**: three sensor counts, three unit costs, three
install costs, three hosting costs, and `testBedDuration`.

**C2. Debounced 400ms** from the last keystroke, and immediately on a discard.

**C3. The browser adds up nothing.** The drafts are POSTed to
`/api/test-beds/calculate` and whatever comes back is rendered.
`buildTestBedCostBreakdown` is the single mapping point for a saved record too,
**so a preview and a save cannot disagree.**

**C4. A preview is NOT a save.** `tbCostPreview` is non-null only while the
figures come from unsaved drafts.

**C5. When the fields go back to their stored values the preview is CLEARED**,
and the stored breakdown becomes the truth again. Dirtiness is by comparison,
not by having typed.

**C6. On refusal it falls back to the STORED breakdown** rather than leaving a
wrong number wearing the unsaved marker - *"at least true about something."*

**C7. THE STALENESS WINDOW, and it has no ordering guard.** Between the edit and
the response the screen shows the previous figures. `runTbCostPreview` assigns
`tbCostPreview = result.ok ? result.data : null` with **no sequence token**, so
two overlapping requests resolve last-to-arrive rather than last-to-be-sent. The
400ms debounce makes overlap unlikely, not impossible: one response slower than
400ms plus a second edit is enough.

**This is Architecture 8's recorded instance, on this very file** -
*"`renderTbStageExitCriteria` had no load-token guard, safe only because it ran
last, until the fetches were parallelised."* Same file, same shape, still
unguarded. **The React build must not reproduce it.**

**C8. A CLEARED FIELD CANNOT BE PREVIEWED AS CLEARED.**

```js
function tbEffectiveValue(key) {
  return tbEdits[key]?.draft || tbPayload?.[key] || ''
}
```

`||`, not `??`. An emptied field has draft `''`, which is falsy, so it falls
through to the **stored** value and the preview prices a field the person has
just cleared. Architecture 11's family: a fallback in the calculation.

**C9. It needs no new editor layer.** The preview is a render, not a control.

---

## 5. The other capabilities

**Date bounds (`refreshTbDateBounds`).** Recomputes native `min`/`max` on both
date inputs from their **effective** values, in place: `estGoLiveDate.min` is
the install date when it is in the future, else today; `estimatedInstallationDate.min`
is today and its `max` is the go-live date when set, removed when not. Updated in
place rather than re-rendered, *"because re-rendering the row would throw away an
open edit."*

**Buyer roles.** Three roles, id-valued lookups over the Account's contacts, and
**selecting saves immediately** - a direct-write control, not a batched field.
The role strings are real values written to `record_contacts` and named by three
live `contact_role_linked` gate rules; renaming any would break those gates.

**Sensor counts, units, scoring, exit criteria, notes, history, use cases,
customer documents, installer, tech team** are enumerated in the accounting and
**not yet enumerated as behaviours.** That is Phase 0's remaining work and it is
not done - see *What is not done* below.

---

## 6. The save path

`tbPatch({ payload: payloadUpdate })` - and `payloadUpdate` does not exist. See
the top of this report.

What is intact around it: `saveTbDirtyEntries` is split out of `saveTbFields` so
score entry reuses the same merge; scores are routed to `recordTbScores` first;
a pending score reason blocks the save and focuses the box; `tbStaleMessage`
carries the 409 sentence; and on success `tbEdits` is cleared and the record
re-read.

---

## 7. Coupled tests, sizing, strings

**Retirement sized by sandbox deletion: FOUR failing tests** - the hook
exemption, the two PATCH wrappers, the client/route key agreement, and the
"Terminus Lead" rename. Recorded for the shell round.

**Strings scan, both ways:**

| | count | files |
|---|---|---|
| code | **6** | `index.html`, `class-rules`, `client-preconditions`, `contact-coupling`, `cost-preview`, `opportunity-headline` |
| prose only | **5** | `app.js`, `style.css`, `routes/contacts.js`, `routes/records.js`, `routes/test-beds.js` |

**The ownership sweep at `:6520` for the shell inventory:** it is one of two
identical derivations (`:8049` is the other), and both read `currentSession`,
which is a `let` **but also assigned to `window`** - so it is reachable, unlike
`industriesCache` or `accountsCache`.

---

## 8. Editor-slot fit

**No gap, and no addendum needed.**

| kind | proven since |
|---|---|
| text | Round 2 |
| select | Round 2 |
| date | Round 5 (A4 carries `min` as descriptor data) |
| textarea | Round 5 |
| **lookup** (`{id, name}`) | **Round 6 (A8-A11)** - and the buyer rows need exactly it |

The cost preview needs no layer: it renders, it does not edit. The date bounds
need `min`/`max` recomputed from sibling values, which A4 already carries as
descriptor data - but **as a static declaration**, and here the bound depends on
another field's live draft. **Named as a question for Phase 1 rather than a
gap**: whether A4's `min` becomes a function of the draft state, or the surface
recomputes descriptors. It is a widening of an existing ruling, not a new layer.

---

## What is NOT done

**Item 5 is incomplete.** Ten of the twenty capabilities are enumerated as
behaviours; **ten are not** - sensor counts, units, scoring, exit criteria,
notes, history, use cases, customer documents, installer, tech team. Scoring
alone is 24 names.

**Item 3's live door measurement is not taken**, for the reason given there.

**Both are deliberate.** The save defect is a decision the round cannot take for
itself, and enumerating ten more capabilities against a surface whose primary
write path is broken would be describing behaviour nobody can currently reach.

---

## Findings

| # | finding | severity |
|---|---|---|
| **T1** | **`payloadUpdate` is not defined: the Test Bed save throws, saves nothing, says nothing, since Round 38** | **live, blocks Phase 1** |
| T2 | the cost preview has no request-ordering guard | live, latent |
| T3 | `tbEffectiveValue` uses `\|\|`, so a cleared field previews its stored value | live |
| T4 | the Round 6 accounting parser missed the arrow-form global; **app.js has 13** | fixed here; shell inventory undercounted |
| T5 | `TB_ALL_EDITABLE_FIELDS` carries two fields the server rejects | deliberate, hazard for Phase 1 |
| T6 | one row carries an empty `data-key` | unexplained |
| T7 | `TB_INSTALL_FIELDS` is an empty group in the union | tidy |
| T8 | read-only rows carry no `data-key`, so a key census cannot see them | census shape |
| T9 | the door fails open on absent ownership | deliberate, must be reproduced not tightened |

**A minor discrepancy in the instruction, recorded rather than acted on:** it
names *"the field-row contract with all six entries"*; the contract has
**seven** addenda. Round 6 added two - the lookup editor and the fifth-contact
verdicts - where one may have been counted. All seven were read.

---

## Gate

**All 21 stages passed** on `bfcae68`, the tree this report is committed on.

Pure 475/475, database 94/94, react 580/580, all 0 fail, typecheck clean, 14
HTTP probes. Every figure parsed from the run.

**AND THE GATE IS GREEN OVER A BROKEN SAVE**, which is the point worth taking
from it. Nothing in the repository POSTs a Test Bed field save, so twenty-one
stages pass on a surface whose primary write path has thrown since Round 38.
The defect was found by reading a variable that had no declaration and then
**exercising the path in a browser** - which is the only instrument that could
have seen it.

**Not pushed. Phase 1 not started, and should not start until T1 has an
answer.**
