# R7 and R8: the Industry fix, and direction (c)

Two commits, `e666602` and `956efb1`, each through a green three-suite gate.
**Nothing pushed.** React suite **998 pass** (994 before R8's four new tests),
conformance **9/9**, live probes **4/4** and **22/22**. Every number here is
emitted by a run.

---

## R7 - THE INDUSTRY BUG, the prerequisite every option inherited

**The defect.** `industry_id` is a real COLUMN - measured live, **17 of 17
rows carry it at the top level and none carries it inside `payload`** - and
`LeadCard` passed the raw payload, so the picker read `--` on every lead,
forever, however the industry was set. `LeadRecord` did not even declare the
column.

**And the second half is the worse half.** Industry carried **no asterisk**,
because the server reads the column and sees it satisfied. **The screen said
"not chosen" about a field the gate said was fine** - Verification 43's
family, a display reading a different source from the enforcement.

**The fix is one mapper, `fieldValuesFor`, beside the field definitions.**
Not two: Phase 0 measured the two surfaces disagreeing about this exact key,
the leads fields calling it `industry_id` and the contact descriptors calling
it `industry`. A second mapper written alongside is the drift this closes.

**Proven live on a real record through the real route, both halves of C23:**

```
picker value === the record's industry_id          PASS
it shows the NAME, "Defence & Military", not the id PASS
Industry carries NO missing-marker                  PASS
CONTROL: address, genuinely missing, DOES mark      PASS
```

**The control is what makes the third line mean anything.** Without it, "no
asterisk" is also true of a build that marks nothing at all.

**Calibrated on the running app**: fix removed, rebuilt, the probe reports
`value=""` and `shownText="--"` - the reported bug reproduced exactly - and
**the two prefill assertions fail by name** while the marker assertions
correctly stay green. Restored byte-identical; reverted run 4/4.

**Six unit tests in the gate with a four-way injection sweep** - payload-only,
the seam misspelling, payload dropped, spread order. All four fired on the
right assertions. Nothing silent.

---

## R8 - DIRECTION (c)

### What changed, and what did not

**The nine slots are untouched.** Back, stage actions, link panel, notes,
status, the 18pt heading, follow-up, park form, qualify hint - all nine
asserted present on a live owned record.

**Only the field cards changed.** The two `Collapsible` + `FieldRow` cards
became the shared dense grid, **stacked full width**.

| at 1440, owned record | before | after |
|---|---|---|
| record fields **visible on load** | **0** | **15** |
| grid columns | n/a (collapsed) | **5** |
| screen height | 876px (showing nothing) | **1065px** (showing everything) |

### THE SAVE PATH IS UNTOUCHED, AND THAT IS THE POINT

`rows` is still the same `FieldRowsController`, so `changes`, `dirtyCount`
and `discardAll` mean exactly what they meant and **`ContactHost.onSave`
never learns the display moved.** Round B measured what a naive swap does to
the change-note trail: it goes silently, and no test on the replacement could
notice, because the replacement never had the behaviour to lose.

**Proven by a real save on a live record, not by argument:**

```
the edit SAVED (city = Kuala Lumpur)                       PASS
exactly ONE note was added (0 -> 1)                        PASS
THE AUDIT TRAIL STILL WRITES:
  "City changed from Singapore to Kuala Lumpur."           PASS
```

### The seam

**The contact surface speaks `industry` end to end; the leads surface speaks
`industry_id`.** One renderer, two vocabularies, translated exactly once in
`contactGridFields` rather than inside the component both share. That is why
`onSave` needed no change at all, and with it the industry-to-column lift and
the revision handshake.

### The door

**A row enforces ownership by refusing to OPEN. An always-open input has no
such moment**, so `canEdit` arrives as `disabled`. One rule, two renderings,
not a second door.

```
owner     : 16 of 16 inputs editable
non-owner : 16 visible, 0 editable, and the way OUT survives
```

### The tests, re-pointed against the contract

| contract | old assertion | re-pointed to |
|---|---|---|
| **C2** lookup shows the NAME | a display row's `textContent` | the picker's **selected option**, plus "no uuid anywhere on the screen" |
| **C4** name is heading AND editable | opened a collapsed card first | the field is present **and not disabled** - editable is asserted harder than before |
| **C11** nothing dirty sends nothing | OPENED a row and saved | **type the same value back** - the requirement under either idiom, and it separates a real comparison from a touched-flag |
| N7, P8 | clicked a display row to open it | the typing, which is what dirties - the click was the idiom's opening step, not the claim |

**Two tests were added rather than re-pointed**, both from the calibration's
silences, and one more asserts the heading and the field hold the same value.

### CALIBRATION: 6 of 6, and the first sweep found TWO SILENT

| injection | verdict |
|---|---|
| the grid stops reading the record | FIRED |
| typing no longer reaches the draft store | FIRED |
| the field card loses the estate frame | FIRED |
| a refused qualify stops tinting | FIRED |
| **the server's outstanding marks are suppressed** | **SILENT, then FIRED** |
| **the door stops reaching the always-open inputs** | **SILENT, then FIRED** |

**The two silences were the finding.** Both are claims this change made true
and nothing asserted - V51 exactly. **The door one is the serious one**: the
live probe covered it, and the live probe is wired to no gate stage. Four
tests close both, and the sweep then fired on each.

**The harness verified its snapshot before injecting, compared bytes after
every injection, wrote an IN-FLIGHT marker so a killed run cannot bless its
own wreckage, and ended byte-identical on both files with a green reverted
run.**

---

## TWO DEFECTS THIS CHANGE CREATED, fixed here under rule 10's limit

1. **The field card lost the estate frame.** `cd-card-contact` stopped
   carrying `pg-card` while its sibling `cd-card-account` kept it. **Caught by
   R6-5 - the guard Round B built for exactly this after it shipped once and
   was found by opening a screenshot.** The frame is now the caller's, because
   the two surfaces sit in different furniture.
2. **The grid resolved to ONE column.** `.lead-complete-grid` is
   `repeat(auto-fit, minmax(190px, 1fr))`, so its density is a function of the
   width it is GIVEN, and inside a half-width `ref-cards` slot that is one
   column. **The ruling asked for the dense grid and the grid cannot be dense
   in 380px.** Stacked full width: five columns, 1248px to 1065px.

Both were found by **opening the screenshot**, which is the only instrument
for this.

## FINDINGS NOT FIXED, on the list under rule 10

**Neither was created by this change**, and the first is only visible now
because this is the first time the OWNER view has been photographed - the
Phase 1 shot was a non-owner, where every control was greyed.

1. **Three contact components render unstyled white buttons on a dark
   screen.** `StageActions` (Nurture, Test Bed, Opportunity),
   `LinkAccountPanel` (Link to Account) and `FollowUpTask` (Save task) carry
   **no class at all**. None of the three is in this change's diff. This is
   the exact fault Verification 7's replacement clause records - "a white
   browser default sitting on a dark screen" - and it is a three-line fix if
   it is wanted.
2. **The eyebrow reads "Lead details" on a Qualified contact.**
   Architecture 9's fourth variant, a literal that was true when typed.

## Not this round, as ruled

**R4 still blocks full retirement (d)**: the create actions are in
`StageActions.tsx` alone, rendered by `ContactHost` alone. **(c) keeps
`ContactPanel`'s layout, so `ContactHost` and the screen survive** and
`INTERACTION_STANDARDS` §5, which names `ContactHost`, stays true.

## What this does NOT establish

- **1440 only.** Nothing at 1240, 1920 or 3440. The grid is responsive, so
  its column count will differ at each, and that has not been looked at.
- **The owned record was BUILT** - created through the real route, then its
  status and account set by admin write, because 0 of the 11 live Qualified
  contacts belong to the probe identity. V47's clause: the surface reads the
  state, not how the record arrived at it. Torn down soft, enumerated from the
  database by tag, 0 left live.
- **No claim about the leads surface's appearance.** `QualifyCompletion` now
  renders the shared grid and its 998-test suite is green, but its screen was
  not re-photographed after the extraction.
- **Summary is still a display/edit row**, deliberately - it lives in its own
  card, not the grid - so the swap is of the two field cards, not of every
  field on the screen.
