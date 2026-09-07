# Round 8 Phase 0: investigation

**Preconditions met.** Brief committed at `fc590cc`; the 21-stage gate green on
that tree before this work and again before this report. Session not refreshed
before either gate (rule 16).

**No product code.** Five items, numbered against the brief.

---

## THE CHECKPOINT HAS FIRED - item 3 stops before Phase 1

**The brief's condition:** *if Phase 0 finds `is-not-mine` readers beyond
`CAN_EDIT_BY_VIEW`, or the sweeps feed anything other than the door, the removal
cost changes and returns to John.*

**Both halves are true.** The detail is item 3; the summary is that the class is
not only the door's input. **It is the entire read-only visual treatment**, and
each sweep also feeds a banner.

**The direction is not in question.** This reports the price, as instructed.

---

## 1. The retirement inventory, both files

### `test-bed-detail.js` - **10 failing tests**, not the 4 Round 7 recorded

Sized by sandbox deletion (`scripts/round6/enumerate-retirement.mjs`), baseline
green, restore **byte-identical**, final restored run green.

```
── THE WORK LIST: 10 failing tests ──
  - every declared hook is actually queried, or the exemption is dead
  - the two wrappers that PATCH on behalf of a caller supply it themselves
  - the client key list and the route schema name exactly the same keys
  - "Terminus Lead" is renamed on the OPPORTUNITY and nowhere else
  - the scan finds a payload identifier at all
  - the scan sees every declaration FORM, including window assignment
  - and it sees an ARROW assigned to window, which the keyword form misses
  - EVERY top-level name is claimed by an enumerated capability
  - and every enumerated name still exists, so the map cannot rot
  - the reachability split is recorded, for the shell round
```

**The number moved because Round 7 added six detectors that read the file** -
`save-payload-declared` and the five `test-bed-accounting` tests. All six are
evidence ABOUT the file and retire with it. **Recorded because a stale 4 would
have under-scoped Phase 2 by six dispositions**, and the brief carries the 4.

| disposition | tests |
|---|---|
| **DROP with the file** (evidence about it) | the accounting's 5, `save-payload-declared`'s 1 |
| **DROP the exemption** (retirement preconditions) | the hook exemption, the two PATCH wrappers, the client/route key agreement, the "Terminus Lead" rename |

**Rename list: EMPTY, and measured.** No name the bundle publishes is declared
at app.js's top level in **any** form - checked across `function`, `var`, `let`,
`const` and `window.X =`. Round 7's rename fixed the only instance and the
deletion creates no new one.

### `contact-detail.js` - **the retirement is INCOMPLETE, and not in the way the brief expected**

**The file is deleted and nothing loads it.** Measured through the stripper:

```
  contact-detail.js      raw:present  LIVE:commented
  test-bed-detail.js     raw:present  LIVE:commented
```

**But the commented tag remains, and it names a file that no longer exists.**
The estate's own precedent rules on exactly this, in `index.html`, about the
Reference tab:

> *A commented tag naming a deleted file is worse than none: it reads as an
> escape route somebody might reach for.*

**So this is an incomplete retirement by the estate's own standard**, and the
defect is that the revert instruction is now a lie: restoring that line loads
nothing.

**And a suite test guards the lie.** `live-form.test.mjs` asserts
`RAW.includes(CD_TAG)` with the message *"the vanilla Contact tag is GONE, so
the one-line revert has nothing to restore"*. **That assertion was correct when
written and is now backwards**: it requires the presence of a tag whose target
was deleted. Architecture 9's fourth variant - a literal that was true when
typed - arriving in a test.

**Phase 2 owes both files the same treatment**: the tag block removed, not
merely commented, and `live-form`'s Contact assertions retired with it.

---

## 2. The dead shell code, by deletion

`scripts/round8/dead-shell-code.mjs`. Each candidate **deleted on its own** from
`app.js`, the pure suite run, the result recorded. In-flight marker, snapshot
asserted, restore compared, final reverted run green, **app.js byte-identical**.

**Candidates: Round 7's own enumeration** - every `app.js` name it dispositioned
as having a React counterpart.

### The result had to be read past a constant

**Every single deletion failed exactly one test**, always the same one: *"and
every name the enumeration DECLARES still exists in app.js"*. That is Round 7's
accounting doing its job - a name deleted while the enumeration still declares
it IS a finding - but it is noise for this question, and a naive reading would
have reported **zero** dead names.

Classified by failures OTHER than that one:

| verdict | count | lines |
|---|---|---|
| **DEAD** - nothing but the bookkeeping fails | **31 names** | **821 lines** |
| real coupling | 2 names | 132 lines |

### The two with real couplings

**`markTbCurrentStageTab` (33 lines)** also breaks *"every declared hook is
actually queried, or the exemption is dead"* in `class-rules.test.mjs`. It is
the sole querier of a declared hook class. **Disposition: dead, and the hook
declaration retires with it** - the same shape as the `.field-editing`
exemption dropped in Round 7.

**`loadTestBedDetailSuperseded` (99 lines)** breaks two:

- *"THE OLD PATH REFUSES rather than going quiet"* - the Round 7 assertion that
  put the refusal there. **Retires with the function.**
- *"the read-only class is applied from ONE value, the way the freeze is"* -
  and **this one is a finding, see item 3.**

---

## 3. THE DOOR - the checkpoint, measured

### 3a. The Test Bed sweep is DEAD, and a test holds it in place

**`loadTestBedDetailSuperseded` begins with `throw`.** Its body - lines 6559 to
6657 - contains the Test Bed ownership sweep at **:6600**.

**So the sweep never runs.** The React `TestBedView` writes the class during
render instead, which is Round 7's own fix.

**And `commercials-wiring.test.mjs` asserts `toggles.length === 2`** - one for
the Opportunity, one for the Test Bed - reading `app.js` for both. **A detector
requires dead code to remain.** It is not wrong about the property it names; it
is reading a file where only one of the two toggles is reachable.

**There is ONE live sweep, not two**: the Opportunity's, at `:8129`.

### 3b. What each sweep feeds BESIDES the door

**Both feed a banner**, and the banner is not the door:

| sweep | feeds |
|---|---|
| Test Bed, `:6600` (**dead**) | the class, **and** `#tb-readonly-banner`'s innerHTML |
| Opportunity, `:8129` (**live**) | the class, **and** `renderOppReadOnlyBanner(notMine)` |

The React Test Bed already renders its own banner from the record. **The
Opportunity's banner is still the sweep's**, and removing the sweep removes it.

### 3c. EVERY reader of `is-not-mine` - the price

Measured with comments stripped (Verification 39). **Calibration: `app.js`
mentions it 6 times raw and 4 in code - 2 were prose**, so the stripper is doing
work and the scan is not reading comments.

**49 code mentions across 11 files.** By kind:

| reader | what it is |
|---|---|
| **`CAN_EDIT_BY_VIEW`, app.js :213 and :217** | the door. Two entries, Test Bed and Opportunity |
| **`frontend/style.css` - 5 rules, 15 selectors** | **THE ENTIRE READ-ONLY VISUAL TREATMENT** |
| `frontend-react/src/testbed/TestBedView.tsx` :93 | the React writer, Round 7 |
| `scripts/probe-readonly-view.mjs` | the live W1 detector, asserts the class both directions |
| `scripts/tests/class-rules.test.mjs` :339, :341 | asserts two of the CSS rules exist |
| `scripts/tests/commercials-wiring.test.mjs` | asserts two toggles, each from a record owner, and the CSS covers 5 element kinds |
| 4 round probes and walks | read it to verify the door live |
| 1 injection harness | injects against the door's registry entry |

**The stylesheet is the finding.** The class is not a flag the door reads; it is
the selector that makes an unowned record non-interactive:

```
  .is-not-mine input, textarea, select      { pointer-events: none; opacity: .45 }
  .is-not-mine .is-inert-action             { pointer-events: none; opacity: .45 }
  .is-not-mine .ref-field-display,
                .cd-name-display,
                .deal-toggle,
                [role="switch"]             { pointer-events: none; opacity: .45 }
  .is-not-mine .btn-primary/-secondary/-ghost/-sm  { opacity: .45 }
  .is-not-mine .field-row-display,
                .field-edit-bar,
                .ref-same-as-account        { pointer-events: none; opacity: .45 }
```

**15 selectors covering 15 target kinds**, including `.field-row-display` and
`.field-edit-bar` - the shared React row and its save bar.

**And `commercials-wiring` records why `pointer-events` is there and dimming
alone was not enough**: *"Dimming alone is what the walk already had: everything
looked slightly grey and every control still accepted input."*

### 3d. The price, stated

**A record read replaces the door's INPUT. It does not replace the class's other
job**, which is every control on an unowned record being visibly and actually
inert. Removing the class means:

1. **The visual treatment must be rebuilt**, per surface or under a React-owned
   class, across 15 selectors and 15 target kinds - including two the shared
   field row uses.
2. **The Opportunity's banner** must move, because its only writer is the sweep.
3. **Five instruments re-pointed**: `probe-readonly-view`, `class-rules`,
   `commercials-wiring`, and the round walks that assert the class.
4. **A behaviour that is currently CSS becomes JavaScript.** The class covers
   controls the React tree does not own - `.deal-toggle`, `[role="switch"]`,
   `.is-inert-action`, the four button classes - on surfaces including the
   still-vanilla Opportunity.

**THE QUESTION FOR JOHN, and it is a real fork:** the ruling removes the door's
dependence on a class a swap can retire, and that is achievable by making
`CAN_EDIT_BY_VIEW` read the record while **keeping the class purely as a
presentation hook** - one writer per view, no door dependence, the Round 7
failure mode gone because the door no longer reads it. That is a much smaller
change than removing the class outright, and it satisfies the ruling's stated
ground.

**Removing the class entirely is a larger, presentational piece of work on
surfaces this round was not scoped to touch.** Recommended split, offered rather
than taken: Phase 1 does the door's read; the class's removal is its own item
with its own walk.

---

## 4. The seam, final state - 14 members

Consumers measured across `frontend-react/src`, tests excluded.

| member | consumers | classification |
|---|---|---|
| `api` | 10 | **PERMANENT** - the shell owns the transport and its clock-skew retry |
| `navigate` | 6 | **PERMANENT** - the router is the shell's |
| `detailLoaded` | 5 | **PERMANENT** - the view's loading state is the shell's |
| `canEditFields` | 2 | **PERMANENT, changing shape** - Phase 1's subject |
| `confirmDiscard` | 2 | **PERMANENT** - the shared dialogue, one focus trap |
| `requestChangeReason` | 1 | **PERMANENT** - same reasoning |
| `currentUserEmail` | 2 | **PERMANENT** - the session is the shell's |
| `currentUserId` | 2 | **PERMANENT** - same |
| `staleWriteHtml` | 2 | **PERMANENT** - one renderer for the 409 sentence |
| `getOppLoadedRevision` | 1 | **TEMPORARY** - bridges the vanilla Opportunity's revision holder |
| `usesWorkflow` | 1 | **TEMPORARY** - a data list published on `window`; retires when the list moves |
| `attemptTransition` | 1 | **TEMPORARY** - the vanilla transition; retires if transitions migrate |
| `takeTestBedLanding` | 1 | **TEMPORARY** - bridges a vanilla `let`; retires with the Test Bed's shell code |
| `setContactReturnView` | 1 | **TEMPORARY, and INVERTED** - the only member the bundle writes and the shell reads. **Retires with `contact-detail.js`** |

**9 permanent, 5 temporary.** No member has zero consumers.

**And the reverse direction, measured**: `app.js` publishes **69** names on
`window`, of which the bundle reads **9** - `detailLoaded`, `canEditFields`,
`takeTestBedLanding`, `attemptTransition`, `staleWriteHtml`,
`getOppLoadedRevision`, `oppPatch`, `requestChangeReason`, `navigate`. The other
60 are the vanilla's own.

---

## 5. What must stay vanilla - the shell's permanent core

**760 lines across 20 names**, of `app.js`'s 8,964.

| group | names | lines |
|---|---|---|
| the router | `navigate` (122), `ALL_VIEWS`, `DETAIL_VIEWS`, `showApp`, `showAuth`, `detailLoaded` | 203 |
| session bootstrap | `init` (66), `currentSession`, `supabaseClient` | 69 |
| the tab strip | `createTabStrip` (170), `createSubTabs` (58) | 228 |
| the shared dialogues | `openDiscardConfirm`, `requestChangeReason` | 100 |
| the door registry | `CAN_EDIT_BY_VIEW`, `canEditFields` | 83 |
| the React mount points | the four `load*OrSayWhyNot` guarded entries | 77 |

**The round does not touch any of it beyond the door registry**, which Phase 1
changes by ruling.

**`createTabStrip` is the largest single piece and is genuinely shared** - the
Opportunity and the Test Bed both use it, and the React `StageTabs` reimplements
its behaviour rather than consuming it. That duplication is recorded, not
resolved: resolving it means the Opportunity's strip too, which is out of scope.

---

## Findings, named

| # | finding |
|---|---|
| **F1** | **The Test Bed's ownership sweep is DEAD** - inside a function whose first statement throws - and `commercials-wiring` asserts it is present. A detector requiring dead code to remain |
| **F2** | **`is-not-mine` has 49 code readers across 11 files**, and the stylesheet's 15 selectors are the read-only treatment itself, not a flag |
| **F3** | **Both sweeps also write a banner.** The Opportunity's has no other writer |
| **F4** | **`contact-detail.js`'s retirement is incomplete**: a commented tag names a deleted file, against the estate's own recorded rule, and a suite test asserts that tag's presence with a message that is now backwards |
| **F5** | **The Test Bed retirement is 10 tests, not 4.** Round 7's own detectors moved the number and the brief carries the stale one |
| **F6** | **31 of 33 candidate names are dead**, 821 lines, each by deletion. The other two carry couplings that retire with them |
| **F7** | **The rename list is empty**, measured across every declaration form |
| **F8** | **Every per-name deletion fails one constant test**, so the raw result reads as "nothing is dead". The finding is about reading the instrument, and it is the same shape as Round 7's `-1 failed` |

---

## What this does NOT establish

**Nothing here was run in a browser.** Every verdict is from source scans and
the pure suite. The claim that 821 lines are dead rests on the suite noticing,
and the suite does not open the app - **a live walk in Phase 3 is what would
catch a name only the browser reaches.**

**The 821 lines are dead TO THE SUITE.** Names reached only through inline
`onclick` in `index.html` would not fail a test. That risk is small here because
the markup those handlers live in is inside `#view-test-bed-detail`, which
`createRoot` clears - but it is stated rather than assumed.

---

## Gate

**All 21 stages passed** before this report, on `fc590cc` plus the untracked
`scripts/round8/`. Pure 490/490, database 94/94, react 902/902, 0 fail.

**PHASE 1 NOT STARTED. The item 3 checkpoint returns to John**: readers beyond
the door exist, both sweeps feed a banner, and the recommended split is above.
