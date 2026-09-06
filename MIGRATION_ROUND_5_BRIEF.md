# Migration Round 5: the Reference tab

**Final, 2026-09-06.** Ruled by John this date: Reference is Round 5's
surface; Contact and Test Bed follow, `app.js` last. Ground: the
contract's birthplace is the sternest first-contact test available, the
editor slot's promised editors arrive at their first real consumer, and
the retirement cadence holds.

The field-row contract's birthplace: 21 click-to-edit rows, 5 read-only,
the ownership door's one true read, a same-as-account address toggle, a
key-contacts sub-panel Round 0 never itemised, and the editor slot's
promised editors (dates, selects, a checkbox, a textarea) arriving at
their first real consumer. `frontend/opportunity-reference.js`, 1,055
lines, mounted as a panel in the opportunity-detail view on the
Commercials pattern.

Method per the skill and all promotions through Round 4. The eleven
findings and both addenda are the first-contact checklist, tested here
harder than anywhere: this is the surface the contract was measured
from, consumed by the component that never looked at it.

**Retirement due at this round's close**, per the ruled policy:
`frontend/opportunity-deal.js` (unloaded since Round 3) with the parity
suite in the same commit, and `frontend/opportunity-deal-versions.js`
(unloaded since Round 4), each deletion its own commit verified as two
claims.

---

## Phase 0: investigation (no product code)

1. **The panel boundary**: everything `app.js` does to the Reference
   tab - the mount at :8012, the pre-render comments at :7911 and
   :7975, tab mechanics, and what crosses (measured both directions,
   data AND behaviour, per the seam rule).
2. **The field census with instrument**: the constants
   (`ALL_EDITABLE_FIELDS` and its parts) against the rendered DOM on
   an initialised, exercised record (the census rules in full), per
   field: label, editor kind (text, select with options, date,
   checkbox, textarea), empty-state contract, read-only set, and
   which rows the contract's 21/5 count actually maps to. Round 0's
   counts have been wrong on both prior surfaces; the census is the
   truth.
3. **The door, measured**: every reader of `is-not-mine` on this
   surface; what `app.js`'s toggle at :7970 derives `notMine` from;
   and the position for the React guard's source of truth - the
   recommendation to evaluate first is that `canEditFields` for this
   surface reads the same class `app.js` maintains (keeping app.js
   the owner of the ownership computation until its own round),
   against the alternative of deriving from the record. Position
   recorded with reasoning.
4. **The key-contacts sub-panel enumerated**: its state, routes,
   CRUD operations, rendering, and whether it is field-row material
   or its own component (the milestone-grid precedent from Round 3).
5. **Same-as-account**: `toggleRefSameAsAccount`, the copied shipping
   keys, what happens on account change, and the payload semantics
   (stored flag versus copied values), as behaviours.
6. **Inbound references classified** (Round 0 counted 40): self-
   generated, markup, app.js, other modules - with the instrument.
7. **Coupled tests and probes with instrument**, classified by the
   Round 3 scheme (behaviour, source-shape, stylesheet), plus
   entry-5-shape strings.
8. **Editor-slot fit**: which census editors the slot already
   handles (text, select), which are new layers (date, checkbox,
   textarea), and whether any needs a contract addendum before
   building.
9. **Retirement preconditions**: what still asserts against the two
   files falling due, so the close-out deletions are enumerated
   before they start.

## Phase 1: the surface, behind the line

The rows through FieldRow and useFieldRows with descriptors from the
census; new editor layers built against the slot's interface with
contract-derived tests (red first); the door wired per the Phase 0
position, injection-calibrated both ways (a not-mine record refuses
every row; a mine record refuses none); the same-as-account behaviour
and key-contacts sub-panel per their enumerations; the first-contact
checklist run finding by finding, verdicts in writing. Nothing
registered; vanilla stays live.

## Phase 2: the swap, whole in one session

The swap commit with re-points, ledger, strings scan, live-form
inversion; THE PRIMARY WRITE PATH WALKED LIVE IN-SESSION: row edits
across every editor kind, the batched save round-trip, the 409 path,
same-as-account round-trip, key-contacts CRUD, and the door walked on
a record the user does not own (refusal on every row, keyboard
included). Visual comparison at three widths on exercised states.
Identity adoption per the standing rules if the census shows the
React render needs it.

## Phase 3: walk, reverts, retirements, close-out

Full walk; revert rehearsal (this surface alone; combined states with
the estate's other reverts as applicable); the three retirement
commits per the policy, two-claims verified; rule promotion check;
CURRENT_STATE.md; close-out against the exit gate with the estate
ledger and Round 6 entry context (Contact, Test Bed, app.js with the
declaration-keyword inventory).

## Exit gate for Round 6

1. All census rows pass the contract recipe live, including the door
   in both directions on real ownership.
2. The first-contact checklist has written verdicts; any amendment is
   a dated contract addendum.
3. The retirements landed clean; the estate ledger restates the
   remaining coupled counts with instruments.
