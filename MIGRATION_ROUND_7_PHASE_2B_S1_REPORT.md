# Round 7 Phase 2b, session 1: the stage-tab shell

**Precondition:** Phase 2 committed at `8ba8795`, 21-stage gate green, reach
instrument in place.

**No swap.** The vanilla Test Bed is still live.

---

## Reach, before and after

| | RENDERED | LOGIC-ONLY | ABSENT | vanilla lines a swap would take |
|---|---|---|---|---|
| **before** | 9 | **5** | 6 | **1838** |
| **after** | **14** | **0** | 6 | **362** |

**LOGIC-ONLY is empty.** The five capabilities Phase 1b built and nothing
imported - scoring, units, exit criteria, sensor counts and use cases, 1,476
vanilla lines - now render.

The ratchet tightened in the same commit: `NOT_RENDERED` in
`test-bed-accounting.test.mjs` went from eleven entries to six, and the gate
fails if the set moves in either direction.

---

## What was built

**Enumerated first**, as a dated addendum to
`MIGRATION_TEST_BED_CAPABILITIES.md`: **T1-T7** (the tab strip) and **P1-P9**
(the stage panel's load), from the vanilla by instruction - `app.js` at `:2419`,
`:6787-6812` and `:6816`.

**Then built, tests red first**, quoted from the run:

```
Error: Failed to resolve import "../testbed/stageTabs" from
  "src/__tests__/testbed-stage-tabs.test.ts". Does the file exist?
```

| module | what it carries |
|---|---|
| `tabModel.ts` | T1-T7: ten tabs, the shared pane, the landing precedence, the feedback rule, the Next Stage gate |
| `stageLoad.ts` | P1-P9: the load token, three concurrent fetches, the pending/settled contract, the terminal branch |
| `StageTabs.tsx` | the strip, the shared stage panel, the green dot, the install-section toggle |
| `StagePanel.tsx` | the exit-criteria list, the scoring card, the two read panels |
| `UnitsPane.tsx` | the units list by type, the shortfall and its correction, the locked counts |
| `UseCasesList.tsx` | the use-case list, whole-list writes |

**50 tests: 26 on the model, 24 on the rendered surface**, the latter driven
**through one root re-rendered**, because `main.tsx` calls `root.render()` again
for every navigation and every mount-shaped assumption stops holding on the
second visit.

---

## Calibration

`scripts/round7/inject-phase-2b.mjs`, verified-snapshot harness.
**26/26 detected, reverted run GREEN, all six files byte-identical.**

**The suite was green on its first run**, which is Verification 47's tell for
tests written to agree with the component. The injections are what make it
evidence, and two of them earned their keep immediately.

### Two SILENT injections, each naming a claim nothing asserted

**P8: the card renders without the `hidden` attribute.** Zero failures. The
rendered test asserted the card is **revealed** once its stage is derived, and
never that it is **hidden while the fetch is in flight** - which is the whole
point of P8, since the alternative is Pre-Site Assessment showing
Qualification's criteria. The attribute was only ever read in the state where
it is false either way. **Verification 14's shape: an assertion satisfied by an
absence.**

**S7: the pane stops filtering by type.** Zero failures. Every rendered fixture
held units of a single type, so removing the filter was invisible.

Both closed with a test that holds the state the injection breaks, and both
injections then fired.

### And then the matcher missed them, which is the caveat this round added

With the gaps closed, both still read **SILENT - but with `1 failed`**. The
injections had fired; the matcher was anchored on the OLD test names. A silent
verdict with a non-zero failure count is the matcher, not a missing detector.
Re-anchored on the tests the injections actually falsify, and 26/26.

---

## Standing detectors

| detector | result |
|---|---|
| accounting | 9/9 pass, ratchet tightened |
| **duplicate ids** | **caught a real defect - see below** |
| computed visibility | 2/2 pass |
| node stability | 4/4 pass |

### The duplicate-id detector caught a live one, and a second reading of itself

**The real defect.** `StagePanel.tsx` rendered `id="tb-stage-scoring-card"`, and
`index.html` still carries that id in markup that sits **outside any React mount
container**. Both would have been in the document at once and
`getElementById` would have returned whichever came first - the Reference bar's
defect exactly, and the reason this detector exists.

**Fixed rather than disposed.** The id is gone; the tree is addressed by
`data-testid` throughout.

**And a second, softer finding from the same run.** It then flagged
`<ReadPanel id="tb-stage-documents-section">` - a **prop** named `id` that is
rendered as a `data-testid`. The detector cannot tell a prop from an attribute,
and neither can a reader skimming the file. **Renamed to `panelId`**, which
removes the ambiguity for both rather than weakening a detector that had just
caught something real.

---

## Surprises

**1. Two filenames collided on a case-insensitive filesystem.**
`stageTabs.ts` (the model) and `StageTabs.tsx` (the component) are one path to
macOS, and TypeScript refused the build with `differs from already included
file name only in casing`. Renamed to `tabModel.ts`. **It is a portability
hazard rather than an inconvenience**: a case-sensitive CI host would resolve
the two imports to different files and the failure would look like something
else entirely. The same collision then happened again with `useCases.ts` and
`UseCases.tsx`.

**2. `Fetched.data` had to be optional, and that is Verification 47.** The
model's first shape made `data` required. The shell's client returns `data?: T`,
so a fixture built from what a reader wants would have agreed with itself and
disagreed with the server. Shaped from the client.

**3. The install section is a visibility toggle in React for the same reason it
is one in the vanilla**, and the reason survived the port intact: the fields
stay mounted so switching stage tabs and back cannot lose an in-progress edit.
Asserted by attribute AND by the computed-visibility detector, per the Round 5
finding that an attribute assertion is not a visibility assertion.

---

## What remains before the swap

**Six capabilities, 362 vanilla lines**, all ABSENT rather than logic-only:

| lines | capability | note |
|---|---|---|
| 96 | installer | the panel's `controls` slot exists; the host passes nothing |
| 72 | tech-team | same slot |
| 69 | validation | the keystroke guard EXISTS; the refusal-with-message does not |
| 59 | customer-documents | nothing built |
| 34 | install-section | install notes |
| 32 | revision-history | nothing built |

---

## Gate

**All 21 stages passed.** Pure 480/480, database 94/94, react **728/728**, all
0 fail, typecheck clean, 14 HTTP probes. Every figure parsed from the run.

The react suite grew by 47 across this session (681 to 728).

**Not pushed. No swap. Phase 2c is not reachable until ABSENT is empty.**
