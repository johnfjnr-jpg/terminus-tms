# Leads, Phase 0: report

Measurement only, read-only against product code. **Nothing pushed.**

**Two findings change a phase's scope before it starts**, and both are at the
top because they are decisions rather than observations:

- **A3 contradicts a recorded contract decision.** Escape currently closes the
  row and *deliberately* does not discard.
- **A1 and A3 are not Lead-only.** They change a component shared by four
  surfaces.

And one blocker: **the P3-P5 mockups are not in the repository.**

---

## 0. What a "Lead" is, established first

Nothing else in this report parses without it.

| | |
|---|---|
| `record_type = 'lead'` records | **0** (exact count) |
| `stage_definitions` for `lead` | **0** |

**The Lead IS the `contact` record type.** `saveContact` ends in
`closeNewLeadModal()`, and `view-leads` calls `loadContactsData()`. The Leads
**list** is `view-leads`; the Lead **detail** is `view-contact-detail`, mounted
by React (`ContactView.tsx`).

**A second, unrelated thing is also called Leads**: `view-leads-legacy`, a
read-only view behind `src/routes/leads.js`, described in `app.js:5155` as
"unrelated to the live Leads/Contacts views". **It is not this round's subject**
and is named here so nobody re-discovers it mid-phase.

---

## 1. The parity gap, per behaviour, with its instrument

**The vanilla reference survives in history, not as a `-vanilla` block.** The
brief allows for either. Measured: the three `-vanilla` blocks are
`deal-form`, `deal-version` and `ref` - **there is no contact or lead block**.
`frontend/contact-detail.js` was deleted at `40a5d8d` ("Round 7 Phase 3 ...
contact-detail.js retired"), **1,327 lines**, and is recoverable at
`40a5d8d~1`. That is the reference for what was lost, and it costs one `git
show`.

| | behaviour | measured today | instrument |
|---|---|---|---|
| **A1** | one form-level Save + Discard in the header | **Both exist.** Per-field Discard at `FieldRow.tsx:148` (`discard-${field.name}`), AND a form-level `EditBar` with `save-all` / `discard-all`. The bar is **not** in the header row. | source census, then live DOM for placement |
| **A2** | focus highlight clears on blur | **No `onBlur` anywhere in the field-row.** And `.field-editing`, the class that named this treatment, is applied by **nothing** in the React tree. | **live-DOM probe required**: what actually highlights is not yet identified |
| **A3** | Escape reverts the field | **Escape CLOSES the row and explicitly does not discard** - `editors.tsx:36`, three handlers | source, confirmed; **see the ruling needed below** |
| **A4** | navigating away from dirty warns and DROPS | not measured this phase | **live-DOM probe required** |
| **A5** | the door reaches every Lead write | **The door does not run on this view at all.** See section 3. | shared enumerator (`enumerate-controls.mjs`) |
| **A6** | unowned lead shows the owner's saved data | follows from A4 + A5 | live-DOM probe, after A4/A5 |

### A3 CONTRADICTS A RECORDED DECISION, and that needs a ruling not an edit

`MIGRATION_FIELD_ROW_CONTRACT.md:231` states it as the contract:

> `onRequestClose(): void   // Escape. The row closes; it does NOT discard`

and line 185 records that behaviours 5 and 6 were **deliberately stated as
negatives** - "discard is not close" - which the contract itself notes made them
read as *specification* rather than as description.

**So A3 is not a regression being recovered. It is a change to a decision that
was taken on purpose**, and Verification 23 is explicit: two correct decisions
about the same question, taken in different rounds, produce a conflict nothing
detects. **The fix is supersession, not a second mechanism** - one of the two
has to be withdrawn in writing.

### A1 AND A3 ARE NOT LEAD-ONLY. THE ROW IS SHARED

`FieldRow` / `EditBar` are imported by **six files across four surfaces**:

```
contact/ContactPanel.tsx      testbed/TestBedPanel.tsx    testbed/TestBedView.tsx
reference/ReferencePanel.tsx  reference/ReferenceHost.tsx  account/AccountView.tsx
```

**Removing per-field Discard removes it from Contact, Test Bed, Reference and
Account.** Making Escape revert changes it on all four. The brief scopes A1-A6
to "Lead Detail", and the component does not have that scope.

*(`ContactPanel.tsx:69` says "shared across four surfaces". Four is right as a
count of surfaces and six is the number of importing files - recorded because a
census that reports four files would look correct and be measuring the wrong
noun.)*

---

## 2. Where the lifecycle lives, and P1's real scope

> **P1 is EXTEND, not build. The completeness enforcement already exists
> server-side and is already data-driven.**

**Statuses today: `Unqualified` (1), `Qualified` (2), `Parked` (3).** There is
**no `Nurture`** anywhere in the estate - not in the schema, not in `src/`, not
in either frontend.

**15 `stage_gate_rules` rows on `contact`** (exact enumeration):

- **14 gate `Unqualified -> Qualified`**, every one `payload_field_required`:
  `name`, `parent_record_id`, `industry_id`, `email`, `mobile`, `jobRole`,
  `address`, `city`, `postcode`, `country`, `region`, `linkedin`, `source`,
  **`summary`**.
- **1 gates `Unqualified -> Parked`** on **`followUpDate`**.

**That is the brief's model already implemented**, including "Summary mandatory
for Qualified" and "Nurture requires a follow-up date". `contacts.js:625` calls
it "server-enforced here, not just a UI gate".

**AND THERE IS A PRIOR RULING ON THE PARKED TRANSITION** (Verification 23: search
for an existing decision before taking a new one). `RECORD_CREATION_ATOMICITY_BRIEF.md`
R4c:

> **Unqualified to Parked: ruled REACHABLE.** The stage configuration is
> corrected in its own small round so the transition is satisfiable, at which
> point the existing `stage_gate_rules` row (`followUpDate`) becomes live and
> **must be proven to gate it**.

**That small round was never run.** P1 either absorbs it or it stays carried -
John's call, and it is decision 2 below.

**What P1 genuinely has to build**, as against extend:

1. **Nurture**, if it is a rename of `Parked` or a fourth status.
2. **The Nurture reason AS A NOTE** - no rule requires a note today.
3. **The follow-up task on ALL statuses** - `followUpDate` exists as a flat
   payload field gating one transition, not as a task with a description.
4. **The disabled Qualify control with an inline hint naming what is missing** -
   the server rules exist; the client-side hint does not.

**Notes are already the brief's model.** `payload.notes` is an array of
`{ text, at, by }`, prepended so newest is first (`contacts.js:212`), and it is
in the owned-keys list at `contacts.js:273`, "append-only Notes History, same
shape/convention as Opportunity's".

---

## 3. Door reachability on the Lead view

**The sweep does not run on this view.** `applyReadOnlyControls` is called from
exactly two places:

```
frontend/app.js:7538   applyReadOnlyControls('view-opportunity-detail', notMine)
frontend/app.js:7563   applyReadOnlyControls('view-opportunity-detail', notMine)
frontend-react/src/testbed/TestBedView.tsx   'view-test-bed-detail'
```

**`view-contact-detail` appears in neither.** A5 is confirmed as a real gap, and
it is the same gap the Test Bed view had before last round's R11 - so the shape
of the fix is known and precedented.

**Whether the shared enumerator SEES the Lead controls is not yet measured** and
needs the census run against `view-contact-detail`. That is a Phase 0 limit, not
a finding.

---

## 4. The Lead data model

Payload fields present, grouped as the lifecycle model needs them:

| group | fields |
|---|---|
| **Contact Details** | `name`, `company`, `jobRole`, `email`, `mobile`, `linkedin`, `industry`, `source` |
| **Address Details** | `address`, `address2`, `city`, `postcode`, `country`, `region` |
| **Summary** | `summary` |
| **Notes** | `payload.notes`, array of `{ text, at, by }`, newest first |
| **Follow-up** | `followUpDate`, a flat payload field |

**A completeness check for Qualified would read the 14 gate rules**, which is
where the definition already lives - not a second list in the client. **A client
hint that names what is missing must read those rows**, or it becomes
Verification 43's fourth instance: a display deriving a gate state by a second
path.

**EMAIL AND MOBILE HAVE NO VALIDATION TODAY.** `descriptors.ts:74-75` sets
`inputMode: 'email'` and `inputMode: 'tel'`, which are **keyboard hints, not
validation** - they change the on-screen keyboard on a phone and constrain
nothing. No pattern, no client check, and no server check in `src/routes/contacts.js`.
P5's field-by-field validation is a build, not an extension.

---

## 5. BLOCKER: the P3-P5 mockups are not in the repository

`image3`, `image4` and `image5` are named as the layouts for the New Lead batch
grid, the Leads List and Lead Detail. **They are not in the repo and were not
supplied in this session.** Searched by name across the tree; no `mockups/`,
`docs/` or `design/` directory exists.

**P1 and P2 do not need them and can proceed.** P3, P4 and P5 cannot start, and
this is named now rather than at the phase boundary because the brief's build
order puts three screen phases behind the logic.

---

## Decisions P1 needs from John

1. **Is Nurture a RENAME of `Parked`, or a fourth status?** A rename touches
   `stage_definitions`, 1 gate rule, `contacts.js`'s Park path, `ParkForm.tsx`
   and every record currently sitting in `Parked`. A fourth status leaves Park
   standing and adds a transition. **Recommend: rename**, because two statuses
   meaning "not now" is the condition Verification 23 describes.
2. **Does P1 absorb the carried `Unqualified -> Parked` reachability item?** It
   is already ruled REACHABLE and is unbuilt, and P1 is the round that makes
   that transition load-bearing. **Recommend: absorb it**, and prove the
   `followUpDate` rule gates it, which the prior ruling explicitly requires.
3. **A3 versus the field-row contract.** The contract says Escape closes and
   does not discard; A3 says Escape reverts. **One must be superseded in
   writing.** Recommend A3 wins for Lead **and the contract is amended for all
   four surfaces**, because a row that behaves differently by surface is worse
   than either rule.
4. **A1's blast radius.** Removing per-field Discard removes it from Contact,
   Test Bed, Reference and Account. **Recommend: accept the blast radius and do
   it once**, rather than forking the row - Architecture 1, never fork the
   engine.

## What this phase does NOT establish

- **A2, A4 and A6 are unmeasured.** They need live-DOM probes, which is
  Phase 0's stated instrument for them; the source census cannot see them.
- **Whether the shared enumerator sees the Lead controls** - the census has not
  been run against `view-contact-detail`.
- **What the vanilla actually did** for A2, A3 and A4. The 1,327-line reference
  is identified and recoverable but has not been read behaviour by behaviour.
- **Nothing about the P3-P5 layouts**, which are blocked on the mockups.
