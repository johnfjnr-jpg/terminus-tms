# The migration: close-out

**Eight rounds, 2026-09-04 to 2026-09-08. The estate carries ZERO vanilla
surface files.**

`frontend/app.js` is the shell and stays: the router, the session, the tab
strip, the dialogues, the door registry and the four React mount points. Every
record surface is React.

---

## The estate

| surface | swapped | round | vanilla file |
|---|---|---|---|
| Opportunity approval | 2026-09-05 | 1 | never had one |
| Account | 2026-09-05 | 2 | `account-detail.js`, retired R4 |
| Commercials / deal panel | 2026-09-06 | 3-4 | `opportunity-deal.js`, retired R6 |
| Reference tab | 2026-09-06 | 5 | `opportunity-reference.js`, retired R6 |
| Contact | 2026-09-07 | 6 | `contact-detail.js`, **retired R8** |
| Test Bed | 2026-09-07 | 7 | `test-bed-detail.js`, **retired R8** |
| the shell | not migrated, by ruling | 8 | `app.js`, 8,060 lines |

**`app.js` fell from 8,990 to 8,060** in Round 8: 953 lines of dead Test Bed
view code, deleted with per-name evidence.

---

## The door model, and its reasoning

**Ruled by John 2026-09-07: the door reads the RECORD.** `owner_id` against the
session, through one derivation in `src/lib/ownership.js`, reached by `app.js`
through `index.html`'s module block and by the React tree by direct import.

**The ground is a measured failure, not a preference.** Round 7's swap retired
the load path that WROTE `is-not-mine`, and `CAN_EDIT_BY_VIEW` read that class:
the banner rendered correctly from the record while the door stayed open, so
every row on somebody else's record was editable. **Silent, and
security-shaped.**

**`is-not-mine` SURVIVES as presentation** and decides nothing. Phase 0 measured
why removing it would be a different job: **5 rules, 15 selectors** covering
inputs, displays, toggles, switches, four button classes and the shared React
row - it is the treatment that makes an unowned record non-interactive, and
dimming alone was measured insufficient once already.

**Whoever loads a record says who owns it.** Neither doored view has a live
record in `app.js`, so a register holds the owner per view and the door compares
it against the session. Two writers, one per view.

### The rehearsal found the model is not independently revertible

Reverting the door alone - the registry reading the class again - leaves the
Opportunity's sweep asking `!window.canEditFields()`, which now reads the class
the sweep is about to write. **Circular: the class is never set, and the door
fails OPEN on a record the user does not own.** Measured live: 21 rows, 21 tab
stops, on somebody else's record.

**A revert must take the sweep's derivation with it.** Recorded rather than
fixed - it is a property of the revert, not of the shipped state.

---

## The field-row contract, final state

**Seven behaviours plus 4b, and twelve addenda** (A1-A12). The component serves
four surfaces.

**A12 is the last and the only one that changed every consumer at once**: a row
the door refuses drops its tab stop - behaviour 7's own logic for the second
cause of the same condition. Evidence is four-surface by construction, and the
live measurement is 0 tab stops of 31 rows with all 31 still reading.

---

## The seam, final membership

**15 members.** Nine permanent, six temporary.

| permanent - the shell genuinely owns it | temporary - bridges a vanilla mechanism |
|---|---|
| `api`, `navigate`, `detailLoaded` | `getOppLoadedRevision` |
| `canEditFields`, `currentUserEmail`, `currentUserId` | `usesWorkflow`, `attemptTransition` |
| `confirmDiscard`, `requestChangeReason`, `staleWriteHtml` | `takeTestBedLanding`, `setViewOwner` |
| | `setContactReturnView` |

**`setContactReturnView` did NOT retire with `contact-detail.js`**, against the
brief's expectation and measured by deletion: it REPLACED the lexical read
rather than depending on it. What retired is the vanilla fallback beside it.

**Two directions.** `app.js` publishes 69 names on `window`, of which the bundle
reads 9. The bundle publishes 8, of which `app.js` declares none - asserted, so
Round 7's registration collision cannot return.

---

## The shell's permanent core - 760 lines, 20 names

| group | lines |
|---|---|
| the router (`navigate`, `showApp`, `detailLoaded`, the view lists) | 203 |
| the tab strip (`createTabStrip`, `createSubTabs`) | 228 |
| the shared dialogues | 100 |
| the door registry | 83 |
| session bootstrap | 69 |
| the four guarded React mount points | 77 |

**`createTabStrip` is the largest and is genuinely shared.** The React
`StageTabs` reimplements its behaviour rather than consuming it; that
duplication is recorded, not resolved - resolving it means the Opportunity's
strip, which is not migrated.

---

## The instruments, and what each caught

| instrument | what it caught |
|---|---|
| **the capability accounting** | Round 6 swapped a surface after censusing FIELDS and lost five capabilities. It then held the Test Bed swap back **twice** - once for measuring file existence rather than reachability, once for measuring a FILE where the decision is a VIEW |
| **the verified-snapshot harness** | destroyed the work it was calibrating twice, then caught its own poisoned baseline; the final reverted run has now been the sole witness **four times** |
| **the live walk** | the registration collision, the door's retired class writer, two invented routes, a stale-closure loader, and a deleted binding with two live callers - **none visible to 900+ tests** |
| **the visual comparison** | a 122px tab-strip overflow at 1240 and a first-paint "Final stage" label, the second found by LOOKING while every assertion passed |
| **the two-claims verifier** | a commented tag naming a deleted file, and then its own inability to tell that from prose about one |
| **`no-undefined-globals`** | built from the deletion defect, calibrated on it |
| **the casing detector** | four filename collisions, the fourth found by machine rather than a broken build |

**The pattern worth keeping: almost every defect that reached a browser was
invisible to the suite, and almost every defect the suite caught was in the
instruments.**

---

## CARRIED ITEMS, for John's disposition

**None is this round's to fix. Each is measured, not suspected.**

### 1. The convert has no transaction

`POST /test-beds/:id/convert` does three inserts with a return between each. A
failure after the second leaves an Opportunity with **no `opportunity_details`
row**, hence no `converted_from_test_bed_id` - which is exactly what the
max-conversions check reads, **so a second conversion is permitted**. The
route's own comment records that this check once returned zero silently and a
second conversion went through.

### 2. `Unqualified -> Parked` is configured and unsatisfiable

`Parked` is `sort_order` 3 with `reachable_from_any_stage` false, so the
transition SKIPS `Qualified` and the route refuses it for any client. A
`stage_gate_rules` row nonetheless exists for it requiring `followUpDate`.

### 3. Must-differ on a score reason - queued

Built in Round 7 Phase 1b, **stripped in 2e by ruling**: a rule the vanilla does
not have is a behaviour change arriving inside a swap. The argument is
unchanged - a person can retype the same sentence and the new level carries the
reasoning given for a different one. **A product decision about what a scorer is
asked.**

### 4. `marginPresentation`

Carried from an earlier round, unchanged.

### 5. The create-route nulling

Carried, unchanged.

### 6. The atomicity flake

`atomicity: 40 genuinely concurrent appends` has failed twice with 1 of 40
refused under full-suite contention, passing in isolation and on re-run. Seen
once at **26ms against a ~5,000ms normal**, which is the tell that it did not
run at all rather than that it found something.

### 7. The revision field's two names

`GET /test-beds/:id` answers `latest_revision_number`; `PATCH` answers
`revision_number`. Measured in Round 7 Phase 0b, unchanged.

---

## The exit gate

| # | criterion | verdict |
|---|---|---|
| 1 | the door model ruled, implemented, proven both directions on every doored surface, with the reopen-on-retired-writer mode guarded or removed | **MET.** Removed by construction - the door reads no class. Proven live on the Test Bed and the vanilla Opportunity, by click, Enter, Space and seed |
| 2 | no vanilla surface file loaded; the dead shell code gone with deletion evidence; the permanent core named and intact | **MET.** Two files retired on three claims each; 953 lines deleted; the core is named above and untouched |
| 3 | every carried item stated for disposition; the close-out reads as the estate's map | **MET.** Seven items above |

---

## Gate

Reported with the closing commit.

**Not pushed. The migration closes on John's word.**
