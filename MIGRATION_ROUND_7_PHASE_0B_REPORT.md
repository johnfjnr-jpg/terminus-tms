# Migration Round 7, Phase 0b: the save fix, then the deferred halves

Session of 2026-09-07. John ruled fix-first.

---

## 1. The save fix

**Two lines, and reading `38df3db`'s diff is what made it two rather than a
rewrite.**

```js
const payloadUpdate = {}
for (const [key, e] of dirtyEntries) payloadUpdate[key] = e.draft
```

Those sat **immediately after** the per-field Initial Lead freshness check that
commit removed, and went with it as collateral. The diff shows the two blocks
adjacent, deleted together.

**Not a revert.** `38df3db`'s own change is right and stays: the record-level
precondition rides `tbPatch`, which sends `expected_revision` and re-reads it
from the response. This restores only what the deletion took, **against today's
precondition** rather than the one it was written for.

**Only-dirty, which is the estate's standing shape**: `dirtyEntries` holds just
the fields opened and changed, so an untouched key is never resent and a
concurrent edit to it is never clobbered. Identical construction to
`saveCdFields` and `performGenericRefSave`.

---

## 2. Calibration

### The live walk: 8/8, residue 0

`scripts/round7/walk-tb-save.mjs`.

| check | result |
|---|---|
| the save no longer throws | no page errors |
| the server holds the edit | `city` was `null`, is now `Kuala Lumpur` |
| **both** dirty fields landed | `siteAddress=9 Restored Street` |
| an untouched key was not resent | `name` intact |
| a stale write is refused **and said so** | *"It is now at revision 3, the screen holds revision 2. Reload before saving."* |
| the refused value did not land | `city=Penang` |

### Two instruments join the estate, because the defect had two halves

**`probe-write-success.mjs` gains a Test Bed field save** - extended rather than
a new stage, which is that file's own stated rule: *"one probe rather than one
per route, so the next boundary extends it instead of adding a stage nobody
remembers to write."* Success path and refusal, asserting the **new behaviour**:
the value lands, the revision **advances**, an untouched key survives the merge,
and a stale revision is refused. **30/30.**

This is the ROUTE half, and the route was always fine. It exists because
*"nothing exercises this write"* is the condition that let the client half hide.

**`save-payload-declared.test.mjs`** asks the one question the defect answers:
when a save sends `{ payload: X }` and X is a bare identifier, does the file
declare it? **Calibrated by removing the declaration exactly as `38df3db` did**
- it fires and names the file and the identifier.

**It is narrow on purpose.** A general used-but-undeclared scan was prototyped
and produced **47 candidates, almost all noise**: shell globals from `app.js`,
single-letter parameters, and words leaking out of HTML template literals. A
scan that cries wolf is worse than none, and a real scope analyser is a linter
rather than a check.

### A finding the probe produced while being written

**`GET /test-beds/:id` answers `latest_revision_number`; `PATCH` answers
`revision_number`** - two names for one value on one resource. The vanilla's
`tbPatch` already reads both, correctly and undocumented.

A probe that assumed one name sent `expected_revision: undefined`, **which means
no precondition**, and the refusal check returned 200 while looking like a
working test. Verification 47's response-fixture clause: a fixture is built from
what the route returns.

---

## 3. The deferred halves

### 3a. The door, live, both directions

`scripts/round7/door-tb.mjs`, **11/11, residue 0.** The not-owned fixture is
built by admin write against a **real second `auth.users` id** the system itself
produces, and the record stays visible because `records_select` is
`auth.uid() is not null`.

| | measured |
|---|---|
| MINE | no `is-not-mine`, **28/28 rows open**, no banner |
| NOT MINE | `is-not-mine` set, banner reads *"Read only · another user's record"* |
| HANDED BACK | the class clears, **28/28 open again** |

### AND THE DOOR IS PRESENTATIONAL, WHICH IS THE FINDING

The three entry paths give **different answers**, and the difference is the
whole of it:

| path | on a record that is NOT yours |
|---|---|
| mouse | **blocked** - `pointer-events: none`, and `elementFromPoint` does not hit the row |
| **keyboard** | **NOT blocked** - `tabIndex: 0`, the row takes focus, and **Enter opens it** |
| `openTbField` | **no ownership check of any kind** - it writes `tbEdits[key]` and unhides the edit half |

**A person can Tab to any of the 28 field rows on somebody else's Test Bed,
press Enter, and edit it, while the dimming tells them it is read only.**

The file's own comment says the class is *"NOT A SECURITY BOUNDARY... RLS is the
boundary"*, and that is true - the write would be refused. But the row opens,
the person types, presses Save, and finds out then.

**Round 5 recorded the inverse on the Reference tab** - a row that reads as live
and does nothing. This is worse in the direction that matters: **it reads as
dead and is live.**

**The migration fixes it by construction.** The field-row contract's behaviour 2
consults `canEditFields()` at **every** entry attempt - click, Enter, Space and
seed - and Round 5 proved it on 21 rows refusing four ways. **That is a
deliberate improvement to record, not a divergence to avoid.**

The probe asserts the **measured** behaviour so it documents the door rather
than failing for ever; Phase 1 asserts the correct behaviour.

### 3b. The ten remaining capabilities

`MIGRATION_TEST_BED_CAPABILITIES.md`, written before any build: **N** notes,
**H** history, **U** use cases, **D** customer documents, **I** installer,
**T** tech team, **S** sensor counts and units, **B** exit criteria,
**C** scoring, **Q** the stage panel.

**Fifteen endpoints beyond the record PATCH**, which is the honest measure of
this surface's width.

Four are worth reading before Phase 1:

**S6. Every unit write is QUEUED, per row**, and **the revision is read inside
the queued link rather than when the click happened** - which is what makes two
quick edits to one unit serialise instead of racing. Architecture 8's new clause
applies directly: a guarantee resting on execution order must be **re-proven in
the new runtime**.

**U3.** Use cases are a **whole-list read-modify-write**, and the revision
handshake is the only thing making concurrent adds safe.

**B3.** An exit-criterion tick is a **timestamp, not a boolean**, because
`payload_field_required` blocks only on `undefined`, `null` and `''` - a stored
`false` would read as present and open the gate.

**C4.** A score's reason must **differ from the one already recorded**, not
merely be non-empty. Round 30 found the non-empty test passing by construction
once the box was prefilled.

---

## Findings

| # | finding | state |
|---|---|---|
| **T1** | the Test Bed save threw and wrote nothing since Round 38 | **FIXED**, walked 8/8, two instruments added |
| **T10** | **the door is presentational: the keyboard opens rows the mouse cannot reach** | **live**, pre-existing, fixed by construction in Phase 1 |
| **T11** | `GET` and `PATCH` name the same revision differently on one resource | live, latent, the client already handles both |
| T2 | the cost preview has no request-ordering guard | live, latent, carried |
| T3 | `tbEffectiveValue` uses `\|\|`, so a cleared field previews its stored value | live, carried |
| T4 | the accounting parser missed the arrow global; **app.js has 13** | fixed Phase 0 |
| T5 | `TB_ALL_EDITABLE_FIELDS` carries two fields the server rejects | deliberate, hazard for Phase 1 |
| T6 | one row carries an empty `data-key` | unexplained, carried |
| T7 | `TB_INSTALL_FIELDS` is an empty group | tidy |
| T8 | read-only rows carry no `data-key` | census shape |
| T9 | the door fails open on absent ownership | deliberate |

---

## What this phase does NOT establish

- **Nothing about the React surface.** No product code was written for it.
- **The units queue and the scoring machinery are enumerated, not measured.**
  S6's serialisation claim is read from the source, not driven.
- **Whether scoring migrates in this round at all.** 24 names against Contact's
  whole surface of 76 is a scale question and it is the business's.

## Gate

**All 21 stages passed** on `4ee5b95`, the tree this report is committed on.

Pure 477/477, database 94/94, react 580/580, all 0 fail, typecheck clean, 14
HTTP probes. Every figure parsed from the run.

The pure suite grew by 2 and the HTTP write-success probe from 23 checks to 30.

**And the gate now means one thing more than it did yesterday.** Twenty-one
stages were green over a Test Bed save that threw on every click for three
rounds. They are still twenty-one stages, but one of them now POSTs a Test Bed
field save and one asserts the payload a save sends is an identifier the file
declares. Neither would have needed to exist if anything had ever exercised
that write.

Transcript: `.verify/verify-1210634956113708.txt`

**Not pushed. Phase 1 follows on sign-off.**
