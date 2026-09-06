# Migration Round 3: close-out

**The React panel is the live Commercials surface.** 39 commits, from the Phase 0
investigation to this close.

---

## 1. The exit gate, answered point by point

### (1) Payload parity: corpus deep-equal, zero unexplained differences

**97 tests pass.** The proof EXECUTES the vanilla reader against the same corpus
entry the React reader is given, rather than reimplementing it, so the two are
compared rather than described. The corpus is derived, not hand-typed, and it
asserts its own coverage of all four empty-state contracts - including the
margin box emptied, which Phase 0 found a corpus can silently never do.

### (2) The walk passes on live and frozen records; the revert is rehearsed and reverts the panel alone

**WALK: 32 of 32**, on a real record through the real server.

The census recipe across representative inputs of all four empty-state
contracts · a latch cycle with the signal sentence, show-all returning to
everything visible, and the form staying clean · the disclosure marking the ROW
· section saves appearing on their own section and clearing · a full save round
trip, record and revision both moved · both freeze paths · **restore fidelity**
· frozen-record behaviour, with a write to a frozen record refused.

**RESTORE FIDELITY, which is the check this round most needed.** A version frozen
with non-trivial milestones, contractor rows, margin overrides and UI state; the
form then moved OFF every one of them, asserted; the version restored through
the discard prompt; and **every carrier asserted back by name** - lump sum,
two margin overrides, both milestone rows, both contractor rows, and the
structure and invoicing.

**REHEARSAL: 7 of 7**, on a branch, performing the documented one-line revert.
React did not mount, the vanilla markup was not hidden, the container stayed
empty, the seam on the page was the vanilla adapter's five members, the vanilla
computed, the version machinery took a version against it, and the approval and
Account surfaces stayed React. **It reverts the panel alone.** Branch discarded;
HEAD and `index.html` byte-identical afterwards, checked rather than assumed.

### (3) The seam is implemented as measured, documented, and the version machinery works untouched against the React form

**28 of 28** against the React form, and **the same machinery works against the
vanilla adapter** in the rehearsal. `opportunity-deal-versions.js` was not
touched by the swap: it is handed its seam by whichever panel mounts, which is
what the D2b ruling was for.

The seam is the ruled one - `freezeCurrentState` (saves if dirty, then returns
what it froze, and THROWS the save's refusal), `hasUnsavedChanges`,
`readContractorMilestones`, `populateForm`, `recompute`, plus the two outward
feeds - documented in `seam.ts` with the measurement that produced it.

---

## 2. What the round found that nothing else would have

Listed because each was invisible to every existing check, and most were found
by a measurement built for something else.

| finding | how it was found |
|---|---|
| **`useCatalogRates` read `data.rates`**, which the route does not return: every cost would have been **$0** against the real server | adopting section 4; all five test files supplied the wrong shape |
| **The panel could not be saved at all.** Section saves called a prop the mount never passed; `#btn-save-deal` was never wired and permanently disabled | the walk |
| **Customer milestones were never saved.** The USD cell was computed for display and never entered the state, and the reader drops a row without it | the walk's restore-fidelity check |
| **Eight of 26 owned keys mapped to no section**, so the lump sum, every margin override, the structure, the invoicing and every milestone row raised no save button | the walk |
| **The cost-basis staleness band was computed and dropped**, so ageing, stale and undated all rendered as current | running the 38 blocks' claims against React |
| **The gate could not tell the swapped tree from the reverted one** | the revert rehearsal |
| **Nine labels quietly renamed**, three sub-headings and eight field notes missing, six readouts visible that the vanilla hides, currencies as free text | the visual comparison |
| **`clearDealFeedback` was invisible to every census** ever taken of its file, because it was declared `export function` | the split |

---

## 3. The estate ledger

| class | count | instrument | state |
|---|---|---|---|
| behaviour blocks (`commercials-wiring`) | 38 | `readCode` + block split, Phase 0's rule | **12 run unchanged** as `src/lib` tests; **26 model a superseded implementation** |
| source-shape blocks | 17 | same | 3 re-pointed, 14 outstanding |
| stylesheet blocks | 8 | same | outstanding |
| coupled to `opportunity-deal.js` | **24** | `vanilla-coupling.test.mjs`, enforced both ways | enumerated; can only shrink |
| adopted identity | 15 ids, 100 classes | two-instrument census + render ratchet | **complete**; `is-scrollable` measured in a browser |
| parity corpus | 97 tests | executes the vanilla reader | green |

**THE 26 HARNESS BLOCKS ARE AN ESTATE ITEM, NOT A PASSING SUITE.** They run
against a cut-down panel and a re-implementation of "the wiring, assembled the
way `opportunity-deal.js` assembles it". They never loaded the vanilla and they
do not load React, so **they pass whatever the live panel does**. Their claims
are now covered against the live panel, and the blocks themselves are debt: they
measure a file that no longer ships.

**THE PARITY SUITE HAS A SCHEDULED DEATH.** It executes the vanilla reader. When
`frontend/opportunity-deal.js` is deleted, those 97 tests go with it, and that is
correct rather than a loss: a parity proof exists to be retired the day one of
its two sides does. **Do not port it.** The React reader's own contract tests are
what survive.

---

## 4. Carried items

| item | what it is |
|---|---|
| `contractorStaged` unreachable row | a cash-flow branch no live path reaches; asserted unreachable, and the assertion FAILS the day a reader makes it reachable, which is the point |
| `WRITABLE_NUMERIC_KEYS` dead import | pre-existing in `opportunity-deal.js`, untouched by this round, dies with the file |
| three unread endpoint fields | returned by the route and read by nothing |
| the create-route address nulling | recorded in Phase 0, not this round's scope |
| the bridge tolerance | `(N + 2) x 0.005`, stated but not enforced as a refusal |
| `window.api` never assigned | an implicit global the shell relies on |
| the lexical-globals inventory | **for the `app.js` round**: `function`/`var` declarations reach `window` and are a deprecation; `let`/`const` never do and are a REDESIGN. Measured names are in the Round 2 notes |

---

## 5. Round 4 entry context

**Round 4 is the version machinery's UI.** It starts from a better position than
Round 3 did:

- `frontend/opportunity-deal-versions.js` is already **split out, rewritten
  against a ruled seam**, and proven to work against two different form
  implementations. That is the hard part of a migration done in advance.
- The seam is not a guess: it was measured in both directions, its behavioural
  members are named, and both forms implement it.
- The version card's markup is still static in `index.html` and still vanilla-
  rendered, so Round 4's surface is well bounded.
- **The 24-entry coupling ledger is the work list** for retiring
  `opportunity-deal.js`, and it can only shrink.
- `live-form.test.mjs` now asserts which form is live, so a swap or a revert in
  Round 4 is visible to the gate rather than silent.

**The one thing to carry in:** the version machinery is the LAST consumer of the
vanilla's shape. When it moves, `frontend/opportunity-deal.js` can go, and with
it the 26 harness blocks and the 97-test parity suite. Round 4 should plan that
deletion rather than discover it.
