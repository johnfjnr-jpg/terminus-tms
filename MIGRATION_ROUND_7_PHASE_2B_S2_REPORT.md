# Round 7 Phase 2b, session 2: the six ABSENT capabilities

**Precondition:** session 1 committed at `6a3d85f`, 21-stage gate green, reach
reading RENDERED 14 / LOGIC-ONLY 0 / ABSENT 6.

**No swap.** The vanilla Test Bed is still live.

---

## Reach, before and after

| | RENDERED | LOGIC-ONLY | ABSENT | vanilla lines a swap would take |
|---|---|---|---|---|
| **before** | 14 | 0 | **6** | **362** |
| **after** | **20** | **0** | **0** | **0** |

**`NOT_RENDERED` is empty**, and the gate is **inverted** in the same commit: it
no longer asserts a recorded debt, it asserts that all twenty capabilities
render and fails the moment one stops. A debt list became a floor.

The full ratchet:

| session | capabilities not rendered | lines |
|---|---|---|
| Phase 2 | 11 (5 logic-only, 6 absent) | 1838 |
| Phase 2b s1 | 6 (0 logic-only, 6 absent) | 362 |
| **Phase 2b s2** | **0** | **0** |

---

## The six, enumerated then built

Enumerated first as a dated addendum - **I1-I7, E1-E5, V1-V7, D1-D7, N1-N4,
H1-H6** - then tests red first:

```
Error: Failed to resolve import "../testbed/installer" from
  "src/__tests__/testbed-absent-six.test.ts". Does the file exist?
```

**57 tests: 29 on the models, 28 on the rendered halves**, the latter driven
through one root re-rendered.

### a. installer (96 lines)

Two states with the search as one of them; the result list capped at eight,
case-insensitive, and **listing rather than hiding on an empty term**; the
record's own Account marked in the results; **Cancel offered only when there is
something to cancel back to**.

**I6 is the one worth naming.** Setting an installer can clear the tech team,
and the server says so. The message is **error-styled, not success-styled**,
because the user has work to do - otherwise a gate that was satisfied a moment
ago starts silently blocking with an empty row and no reason on screen.

**I7:** the surface fetches its own accounts. `accountsCache` is a module-scope
`let` in `app.js` and unreachable from a bundle - the same ruling
`terminusStaffCache` already forced.

### b. tech-team (72 lines)

**E2 is this project's standing argument, for the fourth time: a control that
cannot be used is REPLACED, not disabled.** With no installer there is no
select at all, and a sentence saying why. The server refuses that order with a
422, and an empty select would look available and produce the refusal only after
the user had tried.

**E3 is deliberately NOT collapsed into E2.** An installer with no contacts
still gets a select, whose placeholder names the Account: *No Contacts at Alpha
yet*. There is a control; it simply has nothing in it. The injection that
collapses the two fires.

### c. validation (69 lines) - COMPLETED

The keystroke guard existed. **The refusal did not, and that is the
silent-refusal shape**: the React pattern `^-?\d*$` admits a leading minus, so a
negative could be typed and nothing said no.

**The message is asserted, not just the block.** Three problems with three
sets of words - `must be a number`, `cannot be negative`, `must be a whole
number` - joined as `<label> <problem>` across fields with `. `, and an empty
field is **not** a problem because not-set is legitimate (Architecture 11).

**V5, the banner is OWNED.** `data-owner="validation"`, because the vanilla's
own confirmed-live finding was that identifying "its own" message by CSS class
meant one valid keystroke in another field **erased the server's save error**.

### d. customer-documents (59 lines)

Keyed on the row id throughout - **two client files genuinely called *Site
drawings* are two documents**, and the test carries exactly that pair. Both a
name and a link required before any request; **the inputs clear only on
success**, so a refused add does not cost the typing.

### e. install-section (34 lines)

**N1, measured and worth recording because the name says otherwise:
`TB_INSTALL_FIELDS` is an EMPTY ARRAY.** The section has no field rows of its
own. It is a composition of the installer row, the tech team row and the install
notes.

### f. revision-history (32 lines)

**H2's fixture carries the thing the assertion distinguishes.** The route orders
by timestamp descending and the client must *preserve* that rather than sort. A
descending fixture cannot tell a preserving client from a sorting one, so the
second test feeds an **ascending** list and asserts it comes back ascending. A
client that sorted would be a second reader of the ordering rule.

The notice renders above the **empty state** as well as the table; a failed load
says so and **drops** the notice, because there is nothing to caveat.

---

## Calibration

`scripts/round7/inject-phase-2b-s2.mjs`, verified-snapshot harness.

**31/31 detected. Reverted run GREEN. All nine files byte-identical. No
silences to classify.**

The harness now prints the Verification 51 classification itself: a silent
verdict with **zero** failures names a missing assertion, one with a **non-zero**
count names the matcher. It had nothing to report this run, which is the first
sweep in three sessions where that has been true.

---

## Standing detectors

| detector | result |
|---|---|
| accounting (reach instrument) | 9/9, gate inverted to RENDERED 20 |
| duplicate ids | 3/3, no new dispositions |
| computed visibility | 2/2 |
| node stability | 4/4 |
| **casing collisions (new)** | **2/2, calibrated** |

---

## Surprises

**1. The case-collision happened a THIRD time, so it is now a detector.**
`customerDocs.ts` beside `CustomerDocs.tsx`, after `stageTabs`/`StageTabs` and
`useCases`/`UseCases` in session 1. The convention that produces it is a good
one - a camelCase model beside its PascalCase component - so a rule nobody
remembers at the moment of naming was the wrong answer.

`scripts/tests/no-casing-collision.test.mjs` walks four roots and refuses any
pair differing only in case. **Calibrated by reintroducing the collision**,
watching it fail, and confirming the file it was protecting came back
byte-identical.

**And the reason it is worth a detector rather than a shrug: the hazard is loud
here and quiet elsewhere.** macOS folds case, so TypeScript refuses the build
with a precise message. A case-**sensitive** CI host does not fold: there the two
are genuinely different modules, the import resolves to the other one, and the
failure surfaces somewhere else entirely as a missing export.

**2. The new detector was not in the suite, which is the Round 39 finding
exactly.** It passed on its own and `npm test` never ran it. One line in
`package.json`. Caught by checking rather than by anything failing - the whole
point of that finding is that nothing fails.

**3. `TB_INSTALL_FIELDS` is empty.** A capability called *install-section* that
renders no fields. Only visible by reading the array rather than the name -
Verification 19's shape, from the side where the name over-promises.

**4. A discriminated union caught a lazy test read.** `customerDocInput` returns
`{ok: true, ...} | {ok: false, error}`, and the first test read `.error` off the
union. The typecheck refused it, and the fix made the test assert `ok === false`
first - which is a better test, because it now proves the refusal happened
rather than just reading a field that might not be there.

---

## Gate

**All 21 stages passed.** Pure **482/482**, database 94/94, react **785/785**,
all 0 fail, typecheck clean, 14 HTTP probes. Every figure parsed from the run.

The react suite grew by 57 this session (728 to 785); the pure suite by 2 (480
to 482, the casing detector).

**Not pushed. No swap. Phase 2c is now reachable: the reach gate asserts
RENDERED 20 with an empty unrendered set.**
