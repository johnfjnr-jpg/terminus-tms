# Phase 0: measurement

Read-only against product code, after the F6 first act. Nothing pushed.

---

## 0. The first act, F6, completed

`b721d99`. The gate no longer summarises a SKIP as a PASS.

| proof | result |
|---|---|
| unit, `scripts/tests/gate-verdict.test.mjs` | 7 tests, pure suite 512 to 519 |
| calibration by injection | **5/5 fired, none silent**, final reverted run green, both files byte-identical |
| end to end, no browser, `--round-close` | **exit 1**: *"1 REQUIRED stage did not run, so this gate is UNANSWERED, not green. A ROUND CLOSE MAY NOT REST ON THIS RUN."* |
| end to end, browser, `--round-close` | **22/22, exit 0**, door stage `PASS 89089ms` |

**A wiring fault was caught during the fix and is worth keeping.** The
first version recovered the skipped stage names by parsing them out of
the printed SKIP lines, splitting on the padding. It worked **by luck**:
`padEnd(26)` leaves two spaces after the door stage's 24-character name
and nothing after the **seven** stage names that are 26 or longer. Skips
are now recorded as objects when they happen, with a cross-check that
refuses to report a verdict if the structural record and the printed
summary disagree.

---

## 1. The save-dirty bug: cause found, reproduced live, and it is mine

**Reproduced**, matching John's screenshot exactly:

```
A. freshly opened, untouched
   close -> discard dialogue open: false   (expected false)
B. one valid row typed, NOT saved
   close -> discard dialogue open: true    (expected true)
C. saved: "1 lead created.", grid now "0 ready"
   close -> discard dialogue open: true    <- BUG
```

**A and B are the calibration**: the instrument is shown not firing on a
clean grid and firing on a dirty one, so C's `true` is a reading rather
than a default.

### The cause

`newLeadDirty` in `app.js` has exactly three live sites:

- set **true** by any `input` or `change` inside `#new-contact-form .modal-panel`
- set **false** in exactly one place: **inside `openNewLeadModal`**
- read by the close guard and the backdrop-click guard

**Nothing resets it after a save.** The only reset is on open.

### And it is P5's, by my own hand

Before P5, `closeNewLeadModal` called `clearContactForm()`, whose last
two lines were:

```js
  newLeadDirty = false
  clearNewLeadUnsavedWarning()
```

P5 retired the single-record form and deleted that function as
defined-and-never-called. **The function was dead. The two lines were
not** - they were the post-save dirty reset, and they went with it.

**Verification 43's clause names this exactly:** *when a swap retires a
code path, list what that path WROTE, not only what called it.* P5
enumerated the readers of `clearContactForm` and confirmed zero. It did
not enumerate what `clearContactForm` wrote.

### And the deeper fault underneath, which Phase 1 must decide

`newLeadDirty` is a **shell-side approximation of React-side state**. The
shell infers "dirty" from any input event inside the panel; the grid
actually knows whether it holds unsaved rows. Two readers of one value,
and the shell's reader **cannot see a save at all**.

A one-line reset in the existing `onDone` handler would close John's
screenshot and would still be wrong: `onDone` fires with a `created`
count, and a partial save leaves invalid rows in the grid, so the grid
can be **not clean at the moment `onDone` fires**. The shell cannot tell
those apart.

**Decision Phase 1 needs:** the grid owns its dirty state and reports it
to the shell, rather than the shell guessing. Recommended, and it is the
smaller change of the two once the partial-save case is counted.

---

## 2. Qualify today, and the load-bearing question

### The atomic mechanism EXISTS, and the pattern is directly applicable

`create_opportunity_from_contact`, in
`20260908000003_create_from_requires_source_owner.sql`:
`language plpgsql`, `security invoker`, **five inserts in one
transaction** - `records`, `record_revisions`, `opportunity_details`,
`record_contacts`, `audit_log`. Its sibling `convert_test_bed` is the
same shape.

**So the answer to the round's load-bearing question is: the MECHANISM
exists, the FUNCTION must be built.** This is not new ground. There is a
working precedent, its ownership check (`create_from_requires_source_owner`),
and the Architecture 12 convention that identity and record state are
DERIVED inside the function from `auth.uid()` rather than accepted as
parameters.

### The supersession is exactly one row

The `Unqualified -> Qualified` gate carries **15** `payload_field_required`
rules, measured live:

`name, parent_record_id, industry_id, email, mobile, jobRole, address,
city, postcode, country, region, linkedin, source, summary, company`

**`parent_record_id` IS P1's Account-link precondition.** Removing that
one row leaves **14**, which map exactly onto R1's stated gate:

| group | fields | count |
|---|---|---|
| Contact Details | name, company, jobRole, email, mobile, industry_id, source, linkedin | 8 |
| Address Details | address, city, postcode, country, region | 5 |
| Summary | summary | 1 |

**14.** R1's completeness gate is the current gate minus
`parent_record_id`, with nothing added and nothing else removed. A
one-row migration, guarded and idempotent.

---

## 3. Account create and link: the surface already exists

**`POST /api/contacts/:id/link-account` already accepts BOTH of R1's
shapes** - `account_id` to link an existing Account, or
`new_account_name` to create one and link it. It also takes an optional
`account_details` object for the fuller Account panel.

**And a React picker exists**: `LinkAccountPanel.tsx`, with
`AccountDetailsModal.tsx` beside it.

### But the route is NOT atomic, and that is the finding

Measured in its body: three separate PostgREST calls - insert the Account
`records` row, insert its `record_revisions` row, then update the
Contact's `parent_record_id`. **A failure between them leaves an orphan
Account**, which is precisely the half-state R1 forbids.

**So the account step cannot simply reuse this route inside the
conversion.** The create-or-link has to move inside the new plpgsql
function so that the Account, the Contact and the status flip commit or
roll back together. The existing route stays for the Lead Detail path,
which R4 freezes.

Accounts are ordinary `records` rows of type `account`; the link is the
Contact's `parent_record_id`.

---

## 4. The card: a change, not a rebuild, and full width does not fight

`frontend-react/src/leads/LeadCard.tsx`, built in the LEADS round, already
renders the name line (`lead-card-name`), a sub line (`lead-card-sub`),
Summary and Notes columns, the inline follow-up, and carries the per-card
door via `applyReadOnlyControls(ref.current, notMine)`.

**R2 is largely a change:** Company, Source and Created Date already
render in `lead-card-sub` and move up to the name line; the four action
buttons are new; Add Note and the inline follow-up stay as built.

**Full width has an established precedent and costs one rule.** `.wrap`
caps at `max-width: 1240px`, and `#view-contact-detail` already overrides
it with `max-width: none` plus `padding-right: 62px` - recorded in the
stylesheet with its own measurement history. `#view-leads` takes the same
override. **It does not fight the container.**

---

## 5. The grid: eight fields today, fifteen available

| | fields |
|---|---|
| grid today | name, company, jobRole, industry_id, email, mobile, source, summary |
| `POST /contacts` also accepts | **linkedin, address, address2, city, postcode, country, region** |

**8 today, 15 with R3**, plus `notes`, which the route seeds as the first
Notes History entry rather than as a field.

Seven of the eight additions are the Address Details group - **the same
group the Qualify gate requires** - so R3 and R1 point the same way: a
lead entered completely in the grid is a lead that can be qualified
without reopening it.

**The width constraint is real.** `.modal-panel-batch` is
`min(1480px, 96vw)` with the grid as its own scroll container. Fifteen
columns at the current `min-width: 110px` per input is ~1650px of content,
so it already scrolls horizontally at 1480. R3's "as wide as possible and
scrollable" is satisfied by the existing structure; what Phase 1 must
decide is column sizing, since 15 equal columns make every one unusable.

---

## 6. Decisions Phase 1 needs from John

1. **The dirty-state owner.** The grid reports its own dirty state to the
   shell, rather than the shell inferring it from input events.
   Recommended; the partial-save case is what rules out the one-line fix.
2. **Where the account step lives.** A step inside the Qualify flow on
   the card, or the existing `LinkAccountPanel` reused in a modal. The
   create-or-link logic moves server-side into the function either way.
3. **Cancellation semantics.** R1 says a cancelled account step rolls
   back cleanly. Since nothing is written until the function is called,
   "cancel" is "do not call it" - **so is there any state at all for
   "mid-qualification"**, or is it purely client-side until the user
   resolves the account step? Recommended: purely client-side, because
   any persisted mid-state is a half state by another name.
4. **Grid column sizing** at 15 columns.
5. **Does `--round-close` become mandatory** for a close gate, and should
   stages beyond the door be marked `required`? Today only the door stage
   is. A close with a dead session still exits 0 while reporting
   "14 NOT RUN" - honest, but not refused.

---

## 7. What this phase does not establish

- Nothing was built. No source changed after `b721d99` except this
  report and the brief.
- The live repro drove one account on one browser. The bug is
  deterministic and mechanism-level, so that is enough to name the cause,
  and not enough to claim the fix works - that is Phase 1's calibration.
- **The Qualify conversion has not been exercised at all.** The atomic
  precedent was read, not run. Whether a single function can create an
  Account, create the Contact and flip status without tripping the
  `records` triggers (Verification 46: a new writer inherits every guard
  already on the table) is a Phase 1 measurement.
