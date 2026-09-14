# R1 Contact detail surface swap, Phase 0: measure

Read-only. Round B's facts re-confirmed against `f790f1a` plus one commit
(the brief). Every count below is emitted by a run, none typed (V20). Four
instruments, each calibrated in both directions; two of them caught faults
in themselves before they were read, recorded in section 7.

---

## THE HEADLINE: THREE PREMISES DO NOT HOLD

**None blocks the round. Two change its size, and one is a ruling that
cannot be executed as written.**

### 1. THE JOB IS NOT 15 TESTS. IT IS 78 CASES, 54 OF THEM TOUCHING THE RETIREMENT

| file | cases | disposition |
|---|---|---|
| `contact-capabilities.test.tsx` | **32** | **RE-POINT** - imports `contact/ContactHost` |
| `contact-surface.test.tsx` | **17** | **RE-POINT** - imports `contact/ContactHost` |
| `contact-view.test.tsx` | **5** | **RE-POINT, transitively** - renders `ContactView`, which renders `ContactHost` at line 148 |
| `contact-blocking.test.ts` | 15 | **SURVIVES** - pure logic on `contact/blocking` + `contact/descriptors` |
| `contact-link-account.test.tsx` | 9 | **SURVIVES** - see 5 below |
| **TOTAL** | **78** | **54 touch the retirement, 24 are independent** |

**Where "15" came from.** `contact-blocking.test.ts` holds exactly 15 cases,
and Round B's Phase 1 baseline census counted **15 field rows**. Round B's
sentence - *"the swap leaves 15 tests addressing markup that no longer
renders"* - names the one file in the population that **renders nothing at
all.** It is a hand-typed number describing a run, which is the second-reader
fault (V20) arriving in a report rather than in code.

> **The named job is three and a half times the size the brief budgeted.**
> That is the finding, and it is the one that decides whether Phase 1 fits.

### 2. R4 CANNOT BE EXECUTED AS WRITTEN. THE SAME FINDING THAT STOPPED ROUND B

R4: *"Create-Test-Bed/Opportunity actions STAY on the Contacts list this
round."*

Measured on the current tree:

```
cd-create-test-bed     -> frontend-react/src/contact/StageActions.tsx:68   (one place)
cd-create-opportunity  -> frontend-react/src/contact/StageActions.tsx:70   (one place)
StageActions rendered by -> frontend-react/src/contact/ContactHost.tsx:446 (one thing)
```

**And the Contacts list view holds exactly ONE button** - measured by walking
the `#view-contacts` subtree to its matching close tag, 1081 chars:

```
<button class="btn-sm" id="contacts-mine-toggle" type="button">
'cd-create-test-bed' inside the contacts list view: False
```

> **They are not on the Contacts list. They are on the screen R5 retires.**
> "Leave them where they are" and "retire that screen" cannot both be done.

**This is unchanged from Round B's Phase 0 and is re-confirmed, not
inherited.** It needs a ruling before Phase 1 can start.

### 3. P2's ANSWER IS EMPTY, AND THAT IS NOT THE GOOD NEWS IT LOOKS LIKE

**Zero of the contact tests are among the 13.** Measured directly rather
than read off the earlier list: the family's `hidden`-attribute spelling
appears in 34 files estate-wide, 20 of them blind, and **none is a contact
test.**

**But the family has a second spelling, and the contact tests are full of
it:**

| file | presence assertions | visibility assertions |
|---|---|---|
| `contact-capabilities.test.tsx` | 27 | **0** |
| `contact-link-account.test.tsx` | 4 | **0** |
| `contact-surface.test.tsx` | 3 | **0** |
| `contact-blocking.test.ts` | 2 | **0** |
| `contact-view.test.tsx` | 1 | **0** |
| **TOTAL** | **37** | **0** |

V4's own sentence is *presence is not legibility, and no assertion can tell
them apart.*

**AND THE BRIEF'S REMEDY IS NOT AVAILABLE IN THIS POPULATION.** jsdom
performs **no layout**: `getComputedStyle` returns declared values only,
`offsetParent` and `getBoundingClientRect` are stubs, and jest-dom's
`toBeVisible()` reads the `hidden` attribute and inline style, **not a
stylesheet rule**. So the exact defect this family shipped - a cascade rule
defeating `hidden` - **is undetectable in the React suite by construction.**

> **Re-pointing cannot "fix P2" in these 78 cases, because the correct
> assertion does not exist there.** Saying otherwise would be the proxy
> fault this round was created to avoid.

**What actually guards it, measured:** `scripts/tests/hidden-not-overridden.test.mjs`
is **wired** in the pure suite and scans `frontend/style.css` through the
shared stripper, refusing any rule that gives a `display` to a class the
application hides by attribute unless scoped `:not([hidden])`. **That is a
source scan, and it is the real control.** The React tests keep the
BEHAVIOUR claims; the VISIBILITY claim belongs in Phase 1's live DOM and
screenshot, which is where it can be measured at all.

---

## 4. View/edit mode: mostly built, and two things are not

**Built.** `mode='view'` drops the "Please complete missing data" eyebrow
(`QualifyCompletion.tsx:225`). `onSaveChanges` exists and hands the write
back to the host, **which is what preserves the audit trail** (line 186).
`AccountSection` renders from `parentRecordId`, by the record rather than a
flag. `saveLabel` and `accountActions` are already props.

**Not built, and both are real:**

- **The footer is a completion footer.** `Save and continue` and `Cancel`.
  On a detail view there is nothing to continue to and nothing to cancel;
  the leaving control is Back. A detail view needs `Save changes` and no
  Cancel, or a Cancel that means discard.
- **Every testid on the surface says `lead`.** `lead-incomplete-${leadId}`,
  `lead-missing-`, `lead-fix-save-`, `lead-account-`. On a complete contact,
  **`lead-incomplete-<id>` is a name asserting a property that is false** -
  Architecture 9's fourth variant, a literal nothing can falsify. Six leads
  probes and three gate suites address these names, so renaming is not free.
  **Recommendation: rename, and re-point the citing probes in the same
  change**, because the alternative is a permanent false name on the
  estate's most-used surface. This is an implementation decision and is
  recorded as revisitable.

**AND THE SURFACE IS A FIELD SET, NOT A SCREEN.** This is the size question
underneath R4:

| capability | on `ContactHost` | on the leads surface |
|---|---|---|
| contact + address fields | yes | **yes** |
| account section | yes | **yes** (Round B) |
| Notes history | yes | **yes** |
| Follow-up task | yes | **yes** |
| **Qualify** (`cd-btn-qualify`) | yes | **no** |
| **Park** (`cd-btn-park` + `ParkForm`) | yes | **no** |
| **Create Test Bed** | yes | **no** |
| **Create Opportunity** | yes | **no** |
| **Link / change account** (`LinkAccountPanel`) | yes | partial |
| **The account's own details** (`AccountDetailsModal`) | yes | **no** |

**Six capabilities have no home after the retirement**, and only two of them
are named by any ruling in this round.

---

## 5. `LinkAccountPanel` MUST NOT BE DELETED, and a surviving test is why

`LinkAccountPanel.tsx` exports **`findAccountMatches`**, imported by
`leads/AccountPicker.tsx` - **the leads surface depends on the contact
folder.** `AccountPicker`'s own comment names it as Verification 20's
remedy: one definition, imported.

> **The PANEL retires with `ContactHost`. The MODULE stays**, and
> `contact-link-account.test.tsx`'s first case - *"one substring definition,
> shared by both callers"* - is the test that protects that seam. It
> survives and becomes more load-bearing, not less.

## 6. The frozen constraint: confirmed, and it does not fully dissolve

| component | consumers today | after `ContactHost` retires |
|---|---|---|
| `NotesHistory` | ContactHost, **TestBedHost**, LeadCard | **DOES NOT dissolve** - TestBedHost keeps it |
| `FollowUpTask` | ContactHost, LeadCard | **dissolves** to LeadCard only |
| `LeadFieldInput` | QualifyCompletion, NewLeadGrid, AddressPopup | already leads-only |

`NotesHistory`'s optional-prop discipline stays. Round B's finding,
re-confirmed unchanged.

## Live population: 11 Qualified contacts, not 10

```
contacts returned: 17   Qualified: 11   Unqualified: 6
Qualified with parent_record_id:            11
Qualified with a resolved account object:   11
```

**Round B measured 10.** One contact has been qualified since. **All 11
resolve an account name**, so R6's fix is holding live - the reading Round B
took at 10/10 is now 11/11.

---

## 7. Instrument faults, both caught by calibration before the reading was used

**My comment stripper only removed `//` at LINE START**, so a trailing
comment survived it. The V39 calibration failed on its first direction and
said so. **The estate already had one definition** - `scripts/lib/strip-comments.mjs`,
imported by ten suites - and adopting it was the fix, which is V20's remedy
rather than a repair of mine.

**The shared stripper then RAISED on a `.json` file** rather than returning
it silently. That is V12's author-side clause working: the case is now named
in the code rather than swallowed.

**And my markup slicing was wrong twice** - a string-search segment that ran
to end-of-file and reported **56 buttons in the contacts view**. Walking the
subtree by depth to the matching close tag gives **1**. This is V33's own
recorded fault, *a count is not a structure*, committed by the person
citing it; the 56 was withdrawn before it was used.

**The census counts do not match Round B's and are not meant to.** Round B
scanned 912 files including markdown; this scanned 545 code files. **The
enumeration is the instrument, not the count** (V41), and the in-code file
lists are in `scripts/contact-swap/census-p0.mjs`'s output.

---

## What Phase 1 needs ruled

1. **R4.** The create actions are on the retiring screen. They move onto the
   consolidated surface, or the retirement keeps `StageActions` alive
   somewhere, or they are built onto the Contacts list. **Nothing can be
   built until this is ruled**, and it is the same question Round B stopped
   on.
2. **Qualify, Park, and the account's own details.** Three more capabilities
   with no home and no ruling.
3. **The testids.** Rename to record-neutral and re-point the citing probes,
   or keep `lead-incomplete-` on a complete contact.
4. **The size.** 54 cases, not 15. If the round is to stay one phase, the
   scope has to come down; if the scope stands, Phase 1 is more than one
   sitting.

## What this does NOT establish

- **Nothing about how the consolidated surface looks for a contact.** It has
  never been rendered with a contact's data and screenshotted.
- **No field-level parity.** Round B measured 15-for-15 by name; **a name
  match is not a behaviour match** and this phase did not improve on it.
- **No claim that the 24 surviving cases are sound** - only that they do not
  address retiring markup.
- **The P2 verdict covers two spellings**, the `hidden` attribute and
  presence-for-visibility. A third spelling nobody has been bitten by would
  not appear.
