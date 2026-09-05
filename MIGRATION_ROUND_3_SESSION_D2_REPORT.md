# Migration Round 3, Session D2: item 0 only. The split is stopped.

**2026-09-05.** Gate green at **21 stages**. Nothing pushed. **The split, the
swap and everything downstream of them did NOT happen.**

Item 0 said measure first and that anything both sides need is **a finding to
resolve before the split**. The measurement found one, it is not small, and it
invalidates an interface built two sessions ago. Section 3 is the position.

---

## 1. The measurement

`frontend/opportunity-deal.js` holds **88 top-level names** (85 declarations
plus 3 `window.*`). Each name's body was extracted by slicing between top-level
declarations, and its references computed against that name set.

**Calibrated before being read:** bodies extracted for **85 of 85**;
`versionLabel` came back with 6 lines and zero references (it is a pure
formatter, which is right); `recompute` came back referencing exactly
`readPayload, catalogRates, testBedCost, renderResults`.

### Transitive closure, and why it over-states the seam

| set | count |
|---|---|
| reachable from the version roots | 85 |
| reachable from the form roots | 85 |
| **version-only** | **0** |
| form-only | 3 (`catalogLoaded`, `loadCatalog`, `wireOnce`) |
| **needed by both** | **82** |

**82 of 88 is a true number and a misleading one.** The closure runs
`saveVersion -> recompute -> renderResults -> everything`, so it counts the whole
form as "shared" on the strength of one call. What it does establish is that
**there is no subset of this file that only the version machinery touches.**

### One-hop, which is the seam that matters

The version roots reference **23** names directly. **14 of those are also in the
form's direct set.** Stripping the nine that are version-internal (the roots
referencing each other), **eleven names genuinely cross into the form**:

| crossing name | used by |
|---|---|
| `readPayload` | `saveVersion` |
| `readContractorMilestones` | `saveVersion` |
| `catalogRates` | `saveVersion` |
| `populateForm` | `restoreVersion` |
| `recompute` | `restoreVersion` |
| **`isDealFormDirty`** | **`saveVersion` AND `restoreVersion`** |
| **`saveDeal`** | **`saveVersion`** |
| **`updateDirtyState`** | **`restoreVersion`** |
| **`num`** | **`saveVersion`** |
| **`opportunityId`** | **`loadVersions`, `saveVersion`, `wireApprovalLink`** |
| **`wired`** | **`wireApprovalLink`** |

## 2. THE FINDING: Phase 0 measured five. There are eleven.

**Phase 0 item 2 recorded the seam as five members**, and Session B implemented
exactly those five plus the two outward feeds - **with a test asserting the key
set is EXACTLY seven**, so the interface actively enforces its own
incompleteness.

**The six missed are not trivia, and two of them carry behaviour.** Read
verbatim from the source:

```js
// saveVersion
if (isDealFormDirty()) {
  const saved = await saveDeal()
  ...
}

// restoreVersion
if (isDealFormDirty()) {
  window.openDiscardConfirm(go)
}
```

- **TAKING A VERSION SAVES THE DEAL FIRST** when the form is dirty. A version
  must freeze what is stored, not what is on screen, so the save is part of
  versioning. **Nothing in the seam expresses this**, and a React form behind
  the current seam would have let `saveVersion` freeze an unsaved form.
- **RESTORING OVER A DIRTY FORM PROMPTS** through `openDiscardConfirm` rather
  than silently overwriting. The version machinery asks the FORM whether there is
  anything to lose.

The other four are structural: `updateDirtyState` (restore tells the form to
re-derive), `num` (a helper reading a form input directly), `opportunityId` and
`wired` (module state three version functions read).

**Why Phase 0 missed them.** It measured what `saveVersion` and `restoreVersion`
*touch of the form's DATA* - the reads and writes - and did not enumerate the
form's *behaviour* they invoke. `isDealFormDirty` and `saveDeal` are not data
crossing a boundary; they are the version machinery driving the form. The
question "what crosses?" got a data answer to a behavioural question.

**Same family as Verification 26**: a structural fact ("these five values move
between them") stated as if it settled a behavioural one ("this is everything
that crosses").

## 3. The position, recorded

**The split is stopped**, and the resolution is not "add six members and carry
on". Three of the eleven need a ruling because they change what the boundary
means:

1. **`saveDeal` must be in the seam, and it makes the seam BIDIRECTIONAL in a
   way the current one is not.** Today the seam is "the version machinery reads
   and writes the form". Adding `saveDeal` makes it "the version machinery
   drives a form write that goes to the server through `oppPatch`". That is a
   larger contract and should be named as one.
2. **`isDealFormDirty` is the form's own model, and the version machinery
   branching on it means the two dirty models are already coupled.** The brief
   ruled the form's dirty model must be reproduced and not unified with the
   field-row model. It did not contemplate the version machinery reading it.
3. **`opportunityId` and `wired` are module state, not an interface.** A split
   makes them either parameters or a shared module, and which one is a design
   decision rather than a mechanical move.

**And the split cannot be a "pure move" while these hold.** Item 1 asks for
relocated code byte-identical modulo relocation. With eleven names crossing,
including two behavioural calls, the version file would either need imports the
vanilla has no module system for, or the names would have to become `window.*` -
which is not a pure move, it is a redesign of the coupling.

## 4. What was NOT done

Items 1 through 7 in full: the split, the reason-box relocation, identity
adoption, the swap, the 38-block verdict, the visual comparison, and the revert
procedure. **All of them are downstream of a split whose precondition failed.**

Session B's seam and its test remain as built, and are now **known to be
incomplete**. That is recorded here rather than patched, because widening an
interface whose shape is under question would bake in the answer.

## 5. What surprised

**Version-only is ZERO.** Not one of the 85 names is reachable from the version
roots and not from the form roots. A file that splits cleanly has a version-only
set; this one has none, and the first measurement said so before any code moved.

**The transitive number was nearly the wrong finding.** "82 of 88 are shared"
reads as a catastrophe and is mostly an artefact of one call into `recompute`.
The one-hop measurement is the one with meaning, and running both is what made
the difference visible. A single closure would have produced either false alarm
or false comfort depending on which one I had run.

**`versionLabel` having zero references was the calibration that mattered.** If
the extractor had been over-broad, that pure six-line formatter would have come
back referencing things, and every other number would have been inflated.

## 6. Gate

```
MERGE GATE  21 stages - all passed
  pure 440/440 · database 92/92 · react typecheck · react 344/344
  react bundle freshness · 14 HTTP probes
```

Unchanged from D1: no product code was written this session.

---

## Standing at the close

Not pushed. `frontend/opportunity-deal.js` is untouched and still the panel a
person sees. **The split needs a ruling on the three questions in section 3
before it can proceed**, and the swap needs the split.
