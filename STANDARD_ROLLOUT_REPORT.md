# Standard rollout: the report

**ONE CSS RULE, four surfaces.** React **1009**, conformance and class/hidden
suites **18/18**, live **8 of 8** across every surface the rule reaches.
**Nothing pushed.**

## R1 - the fix, and the cause was sharper than "no class"

The estate has a global rule:

```css
input[type="text"], input[type="date"], select, textarea { background: var(--black); ... }
```

**`FieldRow`'s TEXT editor renders `<input>` with NO `type` attribute**
(`editors.tsx:71`). **`input[type="text"]` does not match an input without the
attribute** - a CSS attribute selector matches the attribute, not the computed
default - so it alone fell through to the browser default and rendered white.
The `date`, `select` and `textarea` editors were always matched and were never
white.

**Fixed by EXTENDING `.lead-field-input`'s selector list** rather than writing
a second block with the same six declarations (Verification 20). The edit half
now wears the estate's standard field dress, and the contact panel's scoped
12px rule gained the edit half too, so a row no longer jumps 12px to 13px on
click.

**It also revived a marker that was inert**: `[data-dirty="true"]` sets
`border-bottom-color: green` on these inputs, and until now there was no border
for it to colour.

## Proven by OPENING an editor, which is the only state the defect exists in

```
OPPORTUNITY  input-name          bg rgb(21,22,28)  13px vs display 13px
TEST BED     input-name          bg rgb(21,22,28)  13px vs display 13px
CONTACT      input-summary       bg rgb(21,22,28)  12px vs display 12px
ACCOUNT      input-terminusLead  bg rgb(21,22,28)  13px vs display 13px
```

**8 of 8.** A resting screenshot proves nothing here: measured, 26 display rows
and 3 inputs at rest.

## BLAST RADIUS - and a correction to my own Phase 0

Phase 0 named **five** consumers. **It is FOUR.** `FollowUpTask` is
**explicitly not a `FieldRow`** - its own comment says so - and its inputs are
`type="date"` and `type="text"`, so the global rule always covered them. **It
was never white and is untouched.**

The four: **Accounts, Test Bed, Opportunities/Reference** (the three in scope)
and **contacts' Summary row**, which merely shares the code. **All four were
opened and measured**, which is the point of naming the radius first.

## R2 - SIZED, and it is a NON-ISSUE

**The 22 unclassed controls in `#opp-tab-commercial` are `type="text"`, so the
global rule already styles them. They are not white.**

**My Group B Phase 0 said they were the likely cause. That was wrong**, and it
was wrong because I inferred it from markup ("no class") instead of reading the
stylesheet. Nothing to fold in and nothing to carry.

## Recorded plainly: four probe faults of my own

- **A fixed delay photographed "Loading the record…"** - a count of a loading
  screen (V6).
- **A non-owner record measured for editable inputs**, which it has none of
  (V25's population clause).
- **A font-size compared against the first display row in the VIEW** rather
  than the editor's own row - two unrelated things.
- **A selector keyed on a `display-` testid** that the Account's first editable
  row does not carry, reading "no editor" on a surface that worked.

**Each was caught before it was reported as a finding**, and each cost a cycle.

## Not established

- **1440 only**, one record per surface.
- **The Commercials tab was never driven** - the tab click does not switch under
  the probe, which is unexplained and unrelated to this fix. It is why R2 was
  settled from the stylesheet rather than live.
