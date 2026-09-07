# Round 8 Phase 1: the door, record-read

**Precondition:** Phase 0 committed at `7f6e085`, gate green, the door ruling
confirmed — the door reads the record; `is-not-mine` survives as presentation
with no door dependence.

**Behind the line.** No swap, no retirement.

---

## 1. The door reads the record

**ONE DEFINITION, in `src/lib/ownership.js`**, reached by both sides:

- **`app.js`** through `index.html`'s module block, which already publishes
  `usesWorkflow` the same way — a classic script cannot import.
- **The React tree** by relative import, the path `deal/` already uses.

`frontend-react/src/testbed/viewLoad.ts` carried its own `notMine` and now
**re-exports the shared one**, so every existing caller is unchanged and there
is only one definition. Verification 20, at the place where two readers of one
value is a defect with teeth.

### The register

`CAN_EDIT_BY_VIEW` cannot read a record directly: **neither doored view has a
live one in `app.js`.** `currentTestBed` is written only inside the dead
`loadTestBedDetailSuperseded`, and the Opportunity has no module-scope record
carrying `owner_id`.

So **whoever loads a record says who owns it**, and the door compares that
against the session:

```js
'test-bed-detail':    () => ownedByMe('test-bed-detail'),
'opportunity-detail': () => ownedByMe('opportunity-detail'),
```

**Two writers, one per view**: the live Opportunity sweep, and React's
`TestBedView`.

**The register lives in the shared module, not in `app.js`** — and that is a
measured decision, not tidiness. See the calibration below: an injection that
stopped it overwriting came back **silent with zero failures**, because nothing
outside a browser could reach it.

### The class is NOT removed

`is-not-mine` still toggles on both views and the stylesheet's 5 rules and 15
selectors are untouched. **What changed is that nothing decides from it.**

**The Round 7 render-order constraint is gone by construction.** That write
happened *during render* because `useFieldRows` read the door while rendering
and an effect was one render too late. The door no longer reads the class, so
the ordering cannot matter — recorded at the site.

---

## 2. The live sweep reconciled; the dead one untouched

**The Opportunity sweep at `:8129` now REPORTS and ASKS** rather than deriving
its own answer:

```js
window.setViewOwner('opportunity-detail', opp.owner_id ?? null)
const notMine = !window.canEditFields()
```

So the sweep and the door **cannot disagree** — the class it still toggles is
presentation, driven by the door's own answer.

**The dead Test Bed sweep is untouched**, per instruction. It retires with its
file in Phase 2.

**And `commercials-wiring`'s `toggles.length === 2` still passes**, because
that dead toggle is still present. **Noted for Phase 2**, as instructed: when
the dead code goes, that assertion must be re-pointed or retired. It is
currently a detector requiring dead code to remain — Phase 0's finding F1.

---

## 3. The tests, red first

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../src/lib/ownership.js'
  imported from .../scripts/tests/ownership.test.mjs
```

**22 tests: 9 on the model and the registry, 13 on the surfaces.**

### Four input methods, on every doored surface

`door-record-read.test.tsx` drives **Test Bed, Contact, Reference tab and
Account**, three claims each:

| claim | why |
|---|---|
| an OWNED record refuses nothing | the counterfactual — without it every refusal below is satisfied by a surface with no rows |
| an UNOWNED record refuses **click, Enter, Space and seed** | Round 7 Phase 0b measured the vanilla door as **presentational**: the mouse was blocked by CSS and the keyboard was not, so a refused row took focus and opened. A click-only assertion would have passed on a wide-open surface |
| and the door needs **NO CLASS** to refuse | the property the ruling is about. The test asserts `document.querySelector('.is-not-mine')` is **null** before measuring, so it is measuring an absence rather than assuming one |

### The register's own claims

- **SET OVERWRITES** — a view loading a second record must not answer with the
  first's owner. The re-navigation defect, at the door.
- **A view that never reported reads as unowned**, which fails OPEN at the door
  and CLOSED at the database.
- **Clearing returns to that state**, not to the last owner.

### The property the ruling exists for

```js
assert.doesNotMatch(registryBody, /is-not-mine/)
assert.doesNotMatch(registryBody, /classList/)
```

**No swap can silently reopen the door, because there is no class in it to
retire the writer of.**

---

## 4. Calibration — 10/10

`scripts/round8/inject-phase-1.mjs`, hardened harness (in-flight marker,
snapshot asserted, restore compared, `expectHang` stop). **Reverted run GREEN,
all five files byte-identical.**

One harness, two runners: the door lives in `app.js`, `index.html` and the
stylesheet, which vitest cannot see.

| injection | verdict |
|---|---|
| the derivation inverts, locking the owner out | DETECTED |
| it stops needing an owner, so an unowned record locks | DETECTED |
| **THE DOOR OPENS FOR EVERYBODY** | DETECTED, 10 failed |
| **the door reads the class again** | DETECTED |
| the Opportunity door stops asking the record | DETECTED |
| the register never overwrites | DETECTED |
| a cleared view falls back to its last owner | DETECTED |
| the shell stops publishing the derivation | DETECTED |
| the React tree defines its own `notMine` again | DETECTED |
| the stylesheet loses the read-only treatment | DETECTED |

### Three silences on the way, each a real gap

**"The Opportunity door stops asking the record" — zero failures.** The
assertion was `derivations.length >= 1`, which one view satisfies. Now
**per doored view**, with the two open-by-ruling views asserted open so the
asymmetry is visible rather than accidental.

**"The register never overwrites" — zero failures.** Nothing could reach it: it
was an object literal inside `app.js`. **That is why it moved into the shared
module** — the fix is structural, not another assertion.

**"The shell stops publishing the derivation" — zero failures.** The assertion
matched `/lib\/ownership\.js/`, which the **import line** still satisfies after
both `window.` assignments are deleted. Verification 17: the probe fired and
measured the wrong thing. Now it asserts the **publication**, because a classic
script cannot see an import nothing publishes.

---

## 5. Standing detectors, and three superseded assertions

| detector | result |
|---|---|
| ownership (new) | 9/9 |
| commercials-wiring | 54/54 |
| class-rules | 7/7 |
| duplicate ids, casing, computed visibility, accounting | all green |
| live-form | **2 superseded, updated** |
| opportunity-headline | **1 superseded, updated** |
| testbed-coupling | **`setViewOwner` disposed** |

**All three superseded assertions asserted the class model**, and each is
rewritten with **the old reasoning kept visible** (Verification 29) rather than
deleted — a reader can tell a changed model from a dropped check. Each now
asserts `ownedByMe`, and one adds the stronger claim: no `is-not-mine` anywhere
in the registry body.

---

## What this does NOT establish

**Nothing was run in a browser.** Every verdict is jsdom and node. The live
walk — the door on a real not-owned record, on every doored surface — is Phase
3's, and the Opportunity's door in particular has **not** been exercised live
under the new model.

**The Opportunity's sweep is asserted by source, not by behaviour.** It calls
`window.canEditFields()`, which needs the shell's own registry and session; no
test drives that path end to end. Phase 3 owes it.

---

## Gate

**All 21 stages passed.** Pure **499/499**, database 94/94, react **915/915**,
all 0 fail, typecheck clean, 14 HTTP probes.

The pure suite grew by 9 (490 to 499, the door's model tests); the react suite
by 13 (902 to 915, the four-surface evidence).

**Not pushed. Phase 2 not started.**
