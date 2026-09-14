# Contact-mode furniture, Phase 1: the surface is mode-aware

Committed at `b228ef0` through a green three-suite gate. **Nothing pushed.**
React **1009 pass**, live probe **21/21** across both modes, calibration
**7/7**, conformance **9/9**, seam ledger **3/3**. Every number emitted by a
run.

---

## The mode signal, and it is not a new one

```js
const qualified = status === 'Qualified'
```

`returnViewFor` and `StageActions` already branch on exactly this.
**`record_type` cannot tell them apart** - leads and contacts are both
`record_type: 'contact'` - so status is the only signal there is, and
mode-awareness adds none.

## The four rulings, measured on BOTH modes

| | contact | lead |
|---|---|---|
| **R1** title | **"Contact details"** | "Lead details" |
| **R2** status chip | **gone** | "UNQUALIFIED" |
| **R3** Nurture | **gone** | present |
| **R4** create | **one Create control** | absent, as always |
| Qualify | absent, as always | present |

**Both columns are asserted, and that is the point rather than thoroughness.**
Every one of these is a conditional, and a test on one branch says nothing
about the other - Verification 24. The ruling is explicit that lead-mode must
not move, so **lead-mode is measured, not assumed.**

## R4: the create now creates

The two inline buttons did this:

```js
onCreate={(kind) => { shell.navigate(kind === 'test-bed' ? 'test-beds' : 'opportunities') }}
```

**They navigated to a list.** They never reached
`POST /contacts/:id/create-test-bed`, never carried the contact, and created
nothing. **R4 adds a capability rather than relocating one.**

One Create control now opens the shell's own flow - the duplicate check, the
warning with a proceed, then the name dialogue with a **server-suggested name
behind a focus trap** - through `shell-services`, the only module allowed to
read `window`.

**Proven by a real create, not by the dialogue appearing:**

```
R4 the SHELL'S OWN name dialogue opened                         PASS
R4 a Test Bed WAS created from the contact (1 found)            PASS
R4 and it carries the contact as its lead ("CMODE Contact")     PASS
```

**And the menu is asserted as a RELATIONSHIP, never a CSS property**
(Verification 4): `position: absolute` is true of a menu parked anywhere on
the page, and this estate has shipped exactly that defect. Measured: the menu
hangs **1px** below its trigger and **0px** off its right edge.

## The door

```
non-owner: 14 fields rendered, 0 editable, Create present and neutralised, Back alive
```

**Both sides of every comparison exist before it is made.** The first run
reported *"0 of 0 fields editable"* and I nearly recorded it as a pass - a
comparison with nothing on either side (Verification 14). The cause was my
own wait: `name !== 'CMODE Lead'` is **true while the heading is still
absent**, so the probe measured a mid-render page (Verification 7). Re-pointed
at the record's own name plus a rendered-cell count, the numbers became real.

---

## THREE DEFECTS, all fixed here, all found by opening the screenshot

**Two this change created**, under rule 10's limit:

1. **The menu items rendered as white blocks with white text.**
   `.contact-create-item` was written for a `<div>` and sets `color` with no
   `background`; I made them `<button>`s, which bring one.
2. **The `+ Create` trigger was a pale pill.** Same cause, one element up:
   `.contact-create-trigger` was written for a `<span>`.

**Every assertion passed on both** - both items present, the menu anchored to
its trigger within a pixel. Verification 7's replacement clause, and it is the
second time this family has bitten inside two rounds.

**And one MADE WORSE by making its neighbour correct**, which rule 10's limit
says is part of the change rather than a new item:

3. **Qualify and Nurture were white browser defaults.** Giving Create its
   proper treatment left them as the only unstyled controls in the same header
   row. **The vanilla's own markup carries `btn-primary` and `btn-ghost` on
   exactly those two** (`frontend/index.html:378-379`); the migration carried
   the controls and left the classes behind. **A row of one styled and two
   unstyled controls is worse than the uniform wrongness it replaced.**

**Now asserted rather than remembered**: a test reads the classes off all
three controls, so the treatment cannot be dropped again silently.

## Calibration: 7 of 7, and the title is injected BOTH WAYS

| injection | verdict |
|---|---|
| R1 title always "Lead details" | FIRED |
| **R1 title always "Contact details"** | **FIRED** |
| R2 chip returns on a contact | FIRED |
| R3 Nurture returns on a contact | FIRED |
| the Qualify treatment dropped again | FIRED |
| R4 choosing Opportunity stops reaching the shell | FIRED |
| R4 the menu stops closing on Escape | FIRED |

Each named the assertion it broke. **The title is injected in both directions
deliberately**: a conditional that always returns one branch passes every test
written for that branch. Reverted run green, both files byte-identical.

## THE SEAM LEDGER REFUSED THE FIRST COMMIT, correctly

```
the React tree reaches back for these and the ledger does not say why: createFromContact
```

A new coupling to the shell must state its reason. Registered, including the
part that matters: **the flow's own state - `ntbContactId`, `ntbType`,
`contactsCache` - is module-scope `let` in `app.js` and unreachable from a
bundle**, so only the entry point crosses and the flow stays the shell's.

---

## For John's walk

**The eyebrow now reads "Contact details" and the first field card is also
titled "Contact Details".** Both are correct in isolation and they sit on one
screen. R1 is explicit, so it is built as ruled and flagged rather than
quietly altered - the card's title is the candidate to change if the
repetition reads badly.

## What this does NOT establish

- **The conformance gate does NOT govern `StageActions`.** Its closure starts
  at `leads/LeadsList.tsx` and nothing under `leads/` imports `StageActions`,
  so the Create control is **not** gate-covered. It uses the estate's declared
  classes and is asserted by unit test, but **claiming gate coverage here
  would be false** and the brief's expectation of it does not hold.
- **1440 only.** Nothing at 1240, 1920 or 3440.
- **`Link to Account` and `Save task` are still unstyled white buttons.**
  `LinkAccountPanel` and `FollowUpTask` are untouched by this round and remain
  on the list from the previous one.
- **Both records were fixtures**, created through the real route, the contact
  promoted by admin write; torn down soft, enumerated by tag, **0 left live**
  including the Test Bed the probe created.
- **No claim about the Contacts list**, which still uses its own hover
  dropdown into the same dialogue and was not touched.
