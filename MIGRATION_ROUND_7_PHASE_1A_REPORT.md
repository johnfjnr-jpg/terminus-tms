# Migration Round 7, Phase 1a: the field surface, behind the line

Session of 2026-09-07. **Nothing registered, no `app.js` change, no swap.** The
vanilla Test Bed view is still the live one.

---

## Nothing is unfinished

All five items landed. One recommendation is recorded and **not taken**, because
it changes a shared component across four surfaces - it is in the contract entry
and named below.

---

## 1. The rows, and the reconciliation that governs them

**28 field rows**, through the proven component, from census descriptors.

**The 34-row reconciliation is asserted, not described:**

```
34  elements carrying [data-key] in the live DOM
-1  #tb-chevron-popup
-3  buyer-<role> lookups          -1  installer          -1  techTeam
=28

30  declared in TB_ALL_EDITABLE_FIELDS
-2  estCostPerUnit, indicativeCost
=28
```

Both halves meet at 28, and a test asserts the arithmetic so it cannot drift
from what Phase 0 measured.

### The empty-`data-key` row, resolved

Phase 0 recorded one row with an empty `data-key` and could not say what it was.
**Measured live: `#tb-chevron-popup`**, a `.chevron-popup hidden` div inside
`#tb-chevron-wrap` - a **shell popup**, not a field row, carrying `data-key`
with no value as a marker attribute.

So it is excluded by identity rather than by count, and the reconciliation is
exact.

### The two unrendered keys, preserved as payload keys

`estCostPerUnit` and `indicativeCost` are **not rows**. The vanilla's own
comment says rendering them *"would put two editable fields on screen whose
every save the server rejects"*, and they stay in `TB_ALL_EDITABLE_FIELDS` only
because that array is also the batched-save list.

**Here the two jobs are separated**: `testBedDescriptors` is what renders,
`PAYLOAD_ONLY_KEYS` is what the save may carry, and `buildPayload` drops them
even if a later change made them rows. Asserted both ways.

---

## 2. The door

**All four entry paths - click, Enter, Space and a seed character - refuse on
all 28 rows when the record is not mine**, and open all 28 when it is.

**This is a construction fix for a measured defect.** Phase 0b measured the
vanilla's three paths disagreeing:

| path | vanilla, on a record that is not yours |
|---|---|
| mouse | **blocked** |
| **keyboard** | **NOT blocked** - `tabIndex: 0`, focuses, Enter opens it |
| `openTbField` | **no ownership check of any kind** |

Behaviour 2 removes the disagreement because there is **one hook, consulted at
every attempt**, and no second mechanism to keep in step. The divergence is
recorded at the site.

**D6: the guard fails closed.** `CAN_EDIT_BY_VIEW` has no `test-bed-detail`
line, so the surface refuses everything until the swap commit adds one - the
same sequencing the Reference tab and Contact both used.

**D7: the guard is consulted at every attempt, never captured at render** - a
door that opens after the mount is honoured without a re-render.

### The one thing measured and NOT changed

**A refused row still carries `tabIndex="0"`.** It takes focus and then refuses.

That is **already the fix** - the vanilla's row focuses *and opens* - but it
leaves a keyboard user landing on a stop that does nothing. Changing it touches
the shared component across four surfaces, so it is **a contract decision rather
than a phase's**, and it is recorded as a recommendation in the seventh entry.

---

## 3. The cost preview

Built per C1-C9, with **both queued findings fixed rather than carried**.

### T2 fixed: a request-ordering guard

The vanilla assigns `tbCostPreview = result.ok ? result.data : null`
unconditionally, so two overlapping requests resolve **last-to-arrive rather
than last-to-be-sent**. The 400ms debounce makes that unlikely, not impossible.

**This is Architecture 8's recorded instance on that very file** -
*"`renderTbStageExitCriteria` had no load-token guard, safe only because it ran
last, until the fetches were parallelised."*

**Latest wins, and a stale response is DROPPED**: a token is taken before the
request and compared after it. Tested by resolving a first request *after* a
second and asserting only the second is applied.

### T3 fixed: a cleared field previews as cleared

`tbEffectiveValue` reads `draft || stored || ''`. `||`, not `??` - so an emptied
field has draft `''`, which is falsy, and the preview **prices the value the
person just removed**.

`effectiveValue` uses `??` semantics: **a draft of `''` is a value, and only the
absence of a draft falls through.** A `'0'` is a value too, which `||` would
also have lost.

### Preserved

**C2** the 400ms debounce. **C5** dirtiness by comparison, so returning to the
stored values clears the preview **without asking the server**. **C6** a refusal
falls back to the stored breakdown. **C4 a preview is not a save**: the runner's
only outbound call is the calculate endpoint, asserted, and the drafts reach it
without the preview owning them.

---

## 4. The rest

**Date bounds** are derived from the live drafts rather than mutated in place.
The vanilla mutates `min`/`max` on the inputs *"because re-rendering the row
would throw away an open edit"*; the React row keeps its draft in the
controller, so **the descriptor can simply carry the bound**. An unset go-live
imposes **no ceiling at all** rather than an empty one nobody can satisfy.

**Buyer lookups** are the proven lookup editor - id-valued, name-labelled, three
roles whose strings are the **real values** named by three live
`contact_role_linked` gate rules.

**The name header** is an ordinary row, the same departure the Reference and
Contact surfaces took.

**The save path** is the fixed vanilla shape: only-dirty, one PATCH, the
revision as precondition, and the **shell's own** stale sentence with its reload
control rather than a local string.

**Notes** reuse the component built for Contact, on the record PATCH with the
same handshake.

---

## 5. Calibration

**10/10 detected**, reverted green, **five files byte-identical**.

**Three injections restore the VANILLA defect** - the door stops being
consulted, the ordering guard is removed, `??` becomes `||` - so the fix is
shown to be a fix rather than a rewrite that happens to pass.

### One came back SILENT with zero failures, and it was the honest kind

Removing the ok-check from the preview's refusal path changed nothing, because
**the test's refusal fixture carried no data**: both the guarded and unguarded
forms produce `null` when there is nothing to produce, so the assertion passed
for a reason unrelated to the guard.

A real refusal has a body - a 400 carries an error object - and rendering it
would put a wrong number on screen wearing the unsaved marker. **The fixture has
one now**, and the injection fires.

Verification 51's caveat working in the direction it was written for: the
non-zero failure count is what separates a matcher problem from a real silence,
and this one was zero.

---

## Findings

| # | finding | state |
|---|---|---|
| T6 | the empty-`data-key` row | **RESOLVED** - `#tb-chevron-popup`, a shell popup |
| T2 | the preview had no ordering guard | **FIXED in React**; the vanilla still carries it |
| T3 | `\|\|` made a cleared field fall back | **FIXED in React**; the vanilla still carries it |
| T10 | the vanilla's door is presentational | **FIXED by construction** |
| **new** | a refused row still takes focus | **recorded, not changed** - a contract decision |

---

## What this phase does NOT establish

- **Nothing has run in a browser.** Every verdict is jsdom. The Reference tab's
  round found five defects no assertion saw and a screenshot did.
- **The registry line is not written**, so nothing mounts and the door refuses
  everything.
- **T2 and T3 are fixed in the React build only.** The vanilla is still live and
  still carries both.
- **Scoring and units are untouched** - 35 of this surface's 136 names, and
  Phase 1b's.

## Gate

**All 21 stages passed** on `7d4a90b`. Pure 477/477, database 94/94, react
633/633, all 0 fail, typecheck clean, 14 HTTP probes. Every figure parsed from
the run. The react suite grew by 53 across this phase.

**Not pushed. Phase 1b follows on sign-off.**
