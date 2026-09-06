# Migration Round 5, Phase 0: the Reference tab, investigated

Session of 2026-09-06. Investigation only; no product code changed.
Numbered against the brief's nine items.

**Nothing stops the round.** Five findings are recorded, three of them live
defects on the vanilla surface and two of them discrepancies with the
contract. None blocks Phase 1, and each has a named disposition below.

---

## Instruments, and what they cost

Every count here is emitted by a run. Four instruments were written, and
**each was wrong before it was right** - recorded because the corrections are
the evidence that the final numbers mean anything.

| instrument | what it was wrong about first |
|---|---|
| `scripts/round5/seam-census.mjs` | nothing; calibrated on the first run |
| `scripts/round5/field-census.mjs` | **five** separate faults, below |
| `scripts/round5/door-and-panels.mjs` | nothing; 11/11 first run |
| `scripts/round5/inbound-and-coupled.mjs` | its own negative calibration string |

**The field census, five corrections.** It read the wrong element for the
same-as-account toggle and for the edit bar; it asserted a count the bar does
not show; it checked the input's visibility *before* opening the row, when
that half is correctly hidden; it clicked a row below the fold, which this
app's inner scroll container does not bring into view; and it clicked a row
on a view still carrying `is-loading`.

**That last one is the one worth keeping.** The rows render *before* the view
is interactive. `#view-opportunity-detail` keeps `is-loading` until
`detailLoaded()` clears it, and its computed `visibility` is `hidden`, so a
real mouse click hits the view rather than the row **while the DOM reads
perfectly**. A wait on "the rows are rendered" is satisfied by the
pre-interactive state, and the counterfactual is exact: the rows exist either
way, and only `is-loading` differs. Verification 7. `elementFromPoint` at the
row's own centre returned `#view-opportunity-detail`, which is what settled it.

**And the inbound scan's negative calibration was satisfied by itself.** The
absent token was written as a literal in a file that lives under `scripts/`,
which the search covers, so the scan found it in its own calibration line.
Verification 39 arriving from the calibration side. The token is now built at
runtime and never appears literally.

---

## 1. The panel boundary

`scripts/round5/seam-census.mjs`, run in both directions, calibrated
known-present / known-absent / stripper-keeps-code before any count.

**Into the panel: one name.** The panel assigns 10 `window` names; `app.js`
uses exactly **one**, `initOpportunityReferencePanel`, called at `app.js:8012`
as an optional call. The other nine (`openRefField`, `discardRefField`,
`toggleRefSameAsAccount`, `kcAdd`, `kcArm`, `kcRecord`, `kcRemove`,
`kcNewContact`, `kcAddRoleChanged`) are **markup handlers**: they exist because
the panel writes `onclick="openRefField('name')"` into its own generated HTML
and into `index.html`. They are not a boundary with `app.js`; they are the
panel calling itself through the global namespace.

**Out of the panel: nine window reads plus six bare globals.**
`WRITABLE_NUMERIC_KEYS`, `closeDateNeedsReason`, `decisionDialogue`,
`oppPatch`, `requestChangeReason`, `revealFieldControl`, `staleWriteHtml`,
`toNumberOrNull`, and `discardRefField` (its own, via markup). The bare
globals that are genuinely external: `api` (x8), `escHtml` (x37), `formatDate`
(x4), `navigate` (x3), `loadOpportunityDetail` (x6),
`openInlineBuyerContactModal` (x1).

**Behaviour crossing, not data** (Verification 50's clause): the panel calls
`loadOpportunityDetail(refOpportunityId)` six times - the panel driving the
SHELL to re-render the whole record, no value passed. That is a crossing a
variable census cannot see.

**Shared DOM ids: two.** `#ref-display-name` and `#view-opportunity-detail`.
Both are couplings no symbol census would find, and the second is the door.

**The declaration split** (Verification 20's table, and the reason it matters):

| declared as | count | consequence for a bundle |
|---|---|---|
| `function` | 24 | reachable from a bundle today; a deprecation |
| `var` | 0 | - |
| `let` | 13 | **unreachable**. `refEdits`, `refPayload`, `refAccount`, `refOppDetails`, `kcRoles`, `kcStances`, `kcAccountContacts`, `kcContext` and five more |
| `const` | 11 | **unreachable**. Every field constant, including `ALL_EDITABLE_FIELDS` |

**The 24 lexical names are a redesign, not an accessor.** The React tree
cannot read `refEdits` or `ALL_EDITABLE_FIELDS` at all, so the descriptors
come from the contract and the drafts live in `useFieldRows`. That is what
Round 2 did for `terminusStaffCache`, and it removes the coupling rather than
bridging it.

## 2. The field census

`scripts/round5/field-census.mjs`, **15/16** with the instrument's own
coverage asserted first. The one failure is the environment, under *Surprises*.

**The contract's 21 / 5 is CONFIRMED, and the second instrument agrees
exactly.** Source keys parsed from `ALL_EDITABLE_FIELDS`: 21. Rendered rows:
21. In source but not the DOM: none. In the DOM but not source: none.

Round 0 has been wrong on both prior surfaces; here it is right.

**But the 21 / 5 describes ONE BRANCH.** With same-as-account ticked the same
surface reads **15 editable and 11 read-only**: the six proposal-address rows
swap from `refFieldRow` to `refReadonlyRow`. The contract's table states one
number for a surface that has two shapes, and does not say which.

**The 21 rows as rendered:**

| section | keys | editor |
|---|---|---|
| header | `name` | text |
| `ref-terminus-rows` | `lead`, `commercial`, `technical`, `legal` | select, staff picker (8 options incl. empty) |
| | `region` | select (6 incl. empty) |
| | `country` | text |
| `ref-customer-rows` | `customerLead` | text |
| | `commAddress`, `commAddress2`, `commCity`, `commPostcode`, `commCountry` | text |
| | `commRegion` | select (6 incl. empty) |
| `ref-dates-rows` | `estClose`, `actualClose`, `estGoLive`, `actualGoLive` | date |
| | `duration` | `text[inputmode=numeric]`, suffix `months` |
| `ref-opptype-row` | `oppType` | select (3 incl. empty) |
| static markup | `summary` | textarea |

Editor kinds: **8 text, 7 select, 4 date, 1 numeric-text, 1 textarea.**

**Two rows bypass `refFieldRow` entirely.** `name` renders from its own header
markup in `index.html:1598`, and `summary` from static markup at
`index.html:1846`. Both still open through the same generic
`openRefField`/`discardRefField`.

**The 5 read-only rows:** Terminus Reference, Stage, Account, Date Created,
Est. Close Date Moves.

### FINDING 1: `estGoLive` declares `noPast` and the render drops it

`DATE_FIELDS` declares `{ key: 'estGoLive', date: true, noPast: true }`, and
its own comment says *"noPast on both this and estGoLive: a past 'estimate' is
nonsensical"*. The render at `opportunity-reference.js:684-687` passes
`{ date, number, integer, suffix }` - **`noPast` is not in the list.**

Measured: `estClose` renders `min="2026-09-06"`; `estGoLive` renders **no
`min` attribute at all**. `estClose` gets one only because line 683 renders it
separately with `{ date: true, noPast: true }` hardcoded.

**What this is NOT:** a data-integrity hole. `isNotPastIsoDate` on the server
rejects the same thing independently, and the constant's comment says so. The
native constraint is missing; the authoritative one is not.

**What it is:** a declared property with no reader, and a comment asserting a
behaviour the code does not have - Architecture 9's fourth variant. **The React
descriptor must not inherit the bug**: `noPast` is data on the field, and the
Phase 1 date editor reads it from the descriptor, which is what makes the
declaration reach the DOM for all four date fields rather than one.

**Disposition:** fixed by construction in Phase 1. Recorded here so the fix is
not mistaken for a behaviour change.

### FINDING 2: the read-only rows carry a tab stop the contract says they must not

Contract behaviour 7: *"the same row without a door and no tab stop"*, and the
React descriptor's `readOnly` doc repeats it.

`refReadonlyRow` emits `<div class="ref-field-display readonly">` with **no
`tabindex` and no `onclick`**. Measured on a live owned record, all five carry
`tabindex="0"` and `aria-disabled="false"`.

**The author is `app.js`, not the row.** `EDIT_OPENING_SELECTOR` at
`app.js:1727` lists `.ref-field-display` **with no `:not(.readonly)`**, and
`refReadonlyRow`'s own class matches it. The sweep at `app.js:1814` then sets
`tabindex` and `aria-disabled` on every match. `aria-disabled` is the
fingerprint: nothing else on this surface writes it.

So on an owned record the five read-only rows are tab stops that do nothing,
and on a non-owned record they are correctly `-1`.

**Disposition: a decision Phase 1 must take deliberately, not inherit.** A
React read-only row built to the contract has no tab stop, which is a
*visible divergence from the vanilla in the owned case*. Recommend building to
the contract and recording the divergence, because the vanilla behaviour is an
unintended side effect of a selector that was written about editable rows.
**This needs no contract addendum** - the contract already says the right
thing; the vanilla disagrees with it.

### FINDING 3: the shared edit bar shows no count

Contract behaviour 6: *"Dirty count is computed across all open drafts."*
`updateRefEditBar` computes `dirtyCount` and uses it only as a boolean, to
toggle `tab-action-idle` on `#ref-save-all` and `#ref-cancel-all`. Measured:
the bar reads `Save changes`, `showsACount: false`, with one row dirty.

The count is computed and discarded. Behaviour 6's *aggregation* is real; its
*count* is not on screen. Recorded so Phase 1 does not invent a number the
vanilla never showed, and so the contract's wording is read as "aggregates"
rather than "displays a count".

## 3. The door, measured, and the position

**Readers of `is-not-mine` on this surface: exactly one in code.**
`opportunity-reference.js:742`, the first line of `openRefField`. That is the
contract's behaviour 2 verbatim.

**Writers: exactly one for this view.** `app.js:7970`, from
`opp.owner_id !== currentSession.user.id`. `commercials-wiring.test.mjs:1515`
already asserts there are exactly two toggles in the whole file, one per view.

**Two further mechanisms read the same class and are NOT the door:**

- **CSS**, `style.css:5359-5362`: `.is-not-mine .ref-field-display { pointer-events: none }`.
- **The tabindex sweep**, `app.js:1813-1817`, which is also Finding 2's author.

Both run at render. The contract's own note is that the door has **no timing
dependency**, unlike these two - and the defect it records is precisely a row
that CSS had made unclickable but that stayed reachable by keyboard.

### The position: `canEditFields()` reads the class, via one line in the shell

**Recommended, and this is the brief's own first candidate.** The shell
already has the mechanism: `CAN_EDIT_BY_VIEW` at `app.js:164` is a per-view
registry carrying `'account-detail': () => true` and returning **false for
everything not yet ruled** - so `canEditFields()` returns false for
`opportunity-detail` today, and Phase 1 must add its line or every row refuses.

```js
'opportunity-detail': () => {
  const v = document.getElementById('view-opportunity-detail')
  return !!v && !v.classList.contains('is-not-mine')
},
```

**Reasoning, and the alternative is genuinely defensible:**

**For reading the class.** There is one writer of ownership for this view and
deriving it again in React makes a second - Verification 20's exact shape, and
this project has three live instances of it (the version bridge, the
exit-criteria gate, the stage panel). The React panel holds neither
`currentSession` nor a settled owner id; deriving would add a new shell
coupling on the surface whose whole premise is that `app.js` migrates LAST.
And the class is what the contract's behaviour 2 actually quotes.

**Against, recorded honestly.** It is a DOM-level coupling to a class
maintained outside the panel's own mount, and the React tree reads *up* out of
its tree to get it. When `app.js` migrates this must become a prop or context.
**It is a dated deprecation, not a resting place.**

**One deliberate divergence, and it is the contract's instruction.** The
vanilla does `getElementById(...)?.classList.contains(...)`, which yields
`undefined` when the element is missing and therefore **opens the row**. The
vanilla fails OPEN on a missing view. Contract finding 10 says FAIL CLOSED, and
the seam's default already does. The `!!v &&` above is what makes the shell's
own implementation agree with the seam it feeds.

## 4. The key-contacts sub-panel: its own component

**Measured.** It renders into `#ref-key-contacts` and contains **zero
`.ref-field-display` elements** - it shares no markup with the row mechanism.

- **State**, all module-lexical and unreachable from a bundle: `kcRoles`,
  `kcStances`, `kcAccountContacts`, `kcContext`, `kcPendingRemainingEntries`.
- **Routes, six**: `GET /api/contact-roles`, `GET /api/contact-stances`,
  `GET /api/contacts`, `POST /api/opportunities/:id/key-contacts`,
  `POST /api/opportunities/:id/key-contacts/:linkId/stance`,
  `DELETE /api/opportunities/:id/key-contacts/:linkId`.
- **CRUD**: `kcAdd`, `kcRemove`, `kcRecord` (armed by `kcArm`),
  `kcAddRoleChanged`, `kcNewContact`.
- **Rendering**: a table (Contact / Role / Stance / Linked), one row per link
  with a stance `<select>`, a note `<input>`, a record button and a remove
  control, all keyed by link UUID; plus an add row (contact select, role
  select, an "other" text input, Add, New contact) and its own `#kc-feedback`.

**Decision: its own component, following the milestone-grid precedent.**

1. **It is a collection over a join table, not named fields on a payload.** A
   `FieldDescriptor` is `{name, label, value}` against one record's payload;
   there is no payload key for "the third key contact's stance".
2. **It does not ride the batched save, and that is the decisive one.**
   `kcAdd`, `kcRemove` and `kcRecord` each write immediately and re-render.
   `refEdits` and the shared bar never see them. Contract behaviour 6 would be
   actively wrong here.
3. **Its dirty is ARMED, not compared.** `kcArm` reveals the record button;
   there is no `draft !== orig`. Behaviour 1 does not describe it.
4. **Round 3's precedent**: the contractor and customer milestone grids were
   built as their own component in `panelParts.tsx` for the same reason.

**The nuance worth recording:** the stance select and note input *look* like
field-row material. Making them rows would import behaviour 1 and behaviour 6
into a place where neither applies, which is how a shared component becomes a
worse fit than two specific ones.

## 5. Same-as-account, as behaviours

- **B1.** The tick is a **direct input**, not a field row:
  `<input type="checkbox" id="ref-input-commAddressSameAsAccount">` inside
  `renderProposalAddress`, with an `onchange` handler.
- **B2.** It writes into `refEdits` under `commAddressSameAsAccount` and so
  **rides the batched save** with every other field. Measured: ticking it
  leaves both bar controls non-idle.
- **B3.** Dirty is by COMPARISON, not by event. `toggleRefSameAsAccount`
  *deletes* the entry when the new value equals the original. Measured:
  ticking on then off returns the bar to idle. This is behaviour 1 applied to a
  checkbox.
- **B4.** ON re-renders **only** `#ref-customer-rows` and swaps the six
  address rows from editable to read-only. Measured: editable 7 to 1, read-only
  1 to 7.
- **B5.** The payload stores a **FLAG, never copied values.** The read-only
  rows render `refAccount?.[ACCOUNT_SHIPPING_KEYS[i]]` live from the linked
  account at render time. Nothing copies the address into the opportunity's
  payload, so an account address change is reflected without a re-save.
- **B6.** When the flag is on and the account has no shipping address,
  `accountHasShipping()` is false and the panel renders an inline note with a
  link to the account instead of six empty rows.
- **B7. On account change**: `refAccount` is re-read from `opp.account` on
  every `renderReferenceTab`, so the displayed address follows the account.
  There is no copy to go stale.

## 6. Inbound references classified

`scripts/round5/inbound-and-coupled.mjs`, search calibrated in both
directions, this round's own investigation scripts excluded (they name the
surface because they measure it).

| class | count |
|---|---|
| markup (`index.html`) | 7 |
| `app.js` | 5 |
| other vanilla modules | 10 |
| tests and probes | 4 |
| stylesheet | 0 |
| React tree | 0 |
| **total** | **26** |

**Round 0 counted 40. The census counts 26**, and per the brief the census is
the truth. Only **one** of the 26 is a load: `index.html:3229`,
`<script src="/opportunity-reference.js"></script>`. Of the other 25, the
great majority are prose - `test-bed-detail.js` and `contact-detail.js` cite
this file five times between them as the pattern they copied, and `app.js`'s
five are all comments.

**The React tree has zero references to it**, which is the useful half: there
is nothing to re-point on the React side.

## 7. Coupled tests and probes

Classified by Round 3's scheme, comments stripped so prose cannot count as a
coupling.

| file | class | what it does |
|---|---|---|
| `scripts/tests/opportunity-dates.test.mjs` | **source-shape** | `readCode`s the file and asserts its date handling |
| `scripts/tests/opportunity-headline.test.mjs` | **stylesheet** + source-shape | reads the file three times; also asserts `.is-not-mine .ref-field-display` and `.is-not-mine .cd-name-display` CSS rules |

**Two files, and no behaviour-class probe exists for this surface** - nothing
drives it in a browser today. That is the gap Phase 2's live walk fills, and
it is why Phase 0 wrote its own browser instruments rather than extending an
existing one.

**Entry-5-shape strings** (a claim inside a data structure, which has a
comment's failure mode and code's authority): searched, **none found** for
this surface. `class-rules.test.mjs`'s `STATE_CLASSES` names
`account-detail.js` and `contact-detail.js`, not this file.

## 8. Editor-slot fit

The slot today: `editor?: 'text' | 'select'`, chosen by `editorFor`, with
`options` selecting the select, `inputMode` driving the keystroke guard, and
`editorTakesSeed(field)` returning `editorFor(field) !== SelectEditor`.

| census editor | rows | slot |
|---|---|---|
| text | 8 | **handled** |
| select | 7 | **handled** |
| `text[inputmode=numeric]` | 1 | **handled** by `inputMode`; the SUFFIX is not |
| date | 4 | **new layer** |
| textarea | 1 | **new layer** |
| checkbox | 1 | not a row at all (item 5, B1) |

### Editors needing a contract addendum BEFORE Phase 1 builds them

**A1. `editorTakesSeed` names the mechanism, not the effect.** It reads
`editorFor(field) !== SelectEditor`. The vanilla's rule is
`revealFieldControl`'s `takesText`, which excludes **both** a select **and**
`input[type=date]` - its comment says so in as many words: *"A date input and a
select cannot hold an arbitrary first character."* Adding a date editor without
amending this makes date rows seed a character the input will discard, which is
finding 6's original defect. **Verification 37 exactly**: a rule naming one
route to an effect. The addendum should restate it as a property the editor
declares, with select and date as its first two members.

**A2. The date editor and `showPicker`.** `revealFieldControl` calls
`input.showPicker()` for a select or a date input when `fromUserGesture`.
**`showPicker` does not appear anywhere in the React tree**, so the existing
select editor is already a silent divergence, and a date editor would inherit
it. Needs a position: port it, or record it as a deliberate difference.

**A3. The suffix.** `duration` displays `12 months`; the descriptor has no
`suffix` concept. It is display-only in the vanilla and appended only in the
display half.

**A4. `noPast` / `min` as descriptor data.** Finding 1's fix: the date editor
reads it from the descriptor so all four date fields inherit it, rather than
one field getting it from a hardcoded call site.

**A5. A row whose original is not a payload key.** `estClose` reads from
`opportunity_details.forecast_close_date` via `refFieldOrigValue`'s
special case, and saves through the close-date-move route. The contract
excludes save semantics deliberately, but the DESCRIPTOR still has to express
"this row's original comes from somewhere other than the payload".

**A6. The textarea editor**, which unlike a select DOES take a seed, per
`revealFieldControl`'s explicit inclusion of `TEXTAREA`.

**None of these is a departure from the contract.** Every one is the second
addendum's own sentence - *"layered on the row, not part of it"* - reaching a
consumer that needs a layer nobody has built yet, which is exactly what the
select was in Round 2.

## 9. Retirement preconditions

Enumerated so Phase 3 is a list. **Mentions in CODE, comments stripped:**

| file | live-loaded | repo mentions | CODE mentions |
|---|---|---|---|
| `frontend/opportunity-deal.js` | no | 75 | **44** |
| `frontend/opportunity-deal-versions.js` | no | 19 | **12** |
| `frontend/deal-feedback.js` | no | 3 | **3** |

**`opportunity-deal.js`, 44 code mentions across 14 files:**

| n | file |
|---|---|
| 20 | `scripts/tests/commercials-wiring.test.mjs` |
| 5 | `scripts/tests/transition-requests.test.mjs` |
| 3 | `scripts/tests/milestone-schedule.test.mjs` |
| 3 | `scripts/tests/vanilla-coupling.test.mjs` |
| 2 | `scripts/tests/live-form.test.mjs` |
| 2 | `scripts/tests/rate-resolution.test.mjs` |
| 2 | `frontend-react/src/__tests__/deal-payload-parity.test.ts` |
| 1 each | `scripts/round4/rehearse-reverts.mjs`, `scripts/round4/two-forms.mjs`, `scripts/tests/opportunity-headline.test.mjs`, `scripts/tests/latches.test.mjs`, `scripts/tests/strip-comments.test.mjs`, `scripts/probe-fact-census.mjs` |

**`opportunity-deal-versions.js`, 12 across 9 files**, led by
`scripts/census-form-filter.mjs` (3) and
`scripts/tests/version-card-coupling.test.mjs` (2).

**`deal-feedback.js` is free once the other two go.** Its three code mentions
are: `frontend/opportunity-deal.js`, `frontend/opportunity-deal-versions.js`,
and this round's own census. Deleting the two files removes two of the three.

**This is a larger retirement than Round 4's.** Round 4 deleted two files with
two unloaded-file assertions between them. Here, `commercials-wiring.test.mjs`
alone reads `opportunity-deal.js` twenty times as a source-shape oracle, and
those assertions do not simply get deleted - each one is a claim about the
Commercials behaviour that either moved to the React tree (re-point) or was
about the vanilla only (retire). **Twenty judgements, not twenty deletions.**

Flagged now, per the brief's own instruction, so Phase 3 does not discover it.

---

## Surprises

**The CDN dependency is a live fragility.** Two census runs failed with
`PAGEERROR supabase is not defined`. `index.html` loads
`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/...` from the network,
and when that request fails the app is degraded while still rendering enough
markup for a naive probe to read counts off it. It cost one confusing run in
this phase. Not this round's scope; recorded because a walk that hits it will
report phantom defects, which is Verification 42's shape from a different
cause.

**The panel calls the shell to re-render the whole record, six times.**
`loadOpportunityDetail` is how this surface refreshes after a write. A React
panel doing the same would re-enter `initOpportunityReferencePanel` on every
save - the Round 4 idempotence question arriving on a second surface, and
worth deciding in Phase 1 rather than discovering in Phase 2.

**`name` and `summary` are not rendered by the row renderer** and never were.
Any count taken from `refFieldRow`'s call sites alone would read 19, not 21.

---

## What this phase does NOT establish

- **The door has been measured only in the OPEN direction.** Every browser
  reading was on a record the test account owns (`notMine: false`). The
  refusal direction is asserted from source and from
  `scripts/probe-readonly-view.mjs`'s existing coverage, not re-measured here.
  Phase 1's injection calibration and Phase 2's walk are where that lands.
- **The 26 inbound references are a count of mentions, not of couplings.**
  Only one is a load; the rest are overwhelmingly prose, and prose does not
  break.
- **No behaviour-class probe existed for this surface**, so nothing here
  inherits an earlier round's live coverage of it.

---

## Gate

**All 21 stages passed** on `031a6fa`, the tree this report is
committed on, clean. Pure 463/463, database
92/92, react 485/485, all 0 fail, and 14 HTTP probes.
Every figure parsed from the run rather than typed.

The precondition gate earlier in this session ran on `21c3841` and its header
read WORKING TREE DIRTY: this round's untracked investigation scripts, which
no gate stage reads. This one is the clean re-run.

Transcript: `.verify/verify-1149240346473166.txt`

**Not pushed. Phase 1 not started.**
