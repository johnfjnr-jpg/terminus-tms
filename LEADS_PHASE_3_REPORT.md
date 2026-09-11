# Leads, P3: the Lead Detail redesign

**Built to the ruled layout and verified 13/13 on the live screen.**
pure 512/512, react 942/942, database 100/100. **Nothing pushed.**

Every claim below is a **live DOM read after a rebuild**, with
`check-dist-fresh.mjs` passing first. The probe refuses to run on a stale
bundle.

---

## 1. TWO FINDINGS THAT NEED A RULING

Both are cases where the ruled layout, followed exactly, would have produced a
screen that cannot do its job. I built the working version and am reporting it
rather than assuming.

### Two gated fields had no home in the layout

The Qualify gate has **15** `payload_field_required` rules. The ruled Contact
Details list is *Company, Email, Mobile, LinkedIn, Industry, Source*.

| field | gated? | in the ruled layout? |
|---|---|---|
| **`jobRole`** | yes | **absent entirely** |
| **`name`** | yes | the **18pt heading** - and a heading is not editable |

> **A screen that renders the Qualify hint while giving a person no way to
> satisfy it is worse than one that renders neither.**

**Both are now rows in Contact Details.** The 18pt heading stays exactly as
ruled and displays the name; the row is what makes it editable. If you would
rather the name were uneditable after creation, that is a ruling and I will
take it - but it should be a decision, not a side effect of where the name is
drawn.

### `× Delete` sits under the lead name

The ruled header row is *status badge, Qualify, Nurture, Save, Discard*.
`StageActions` also renders **Unqualify** and **Delete**, which are existing
capabilities the layout does not mention. They currently render inside the
header block, and Delete reads as a stray line under the name. **Not moved,
because where they belong is a layout decision.**

---

## 2. The layout, verified

```
the ruled order, top to bottom   back < title < header < summary
                                 < notes < cards < account < follow-up
the lead name is 18px            PASS
the title is green               PASS
Contact Details and Address SIDE BY SIDE   equal tops, 440 == 440
both COLLAPSED by default        PASS
NO per-field discard anywhere    0 found
Qualify present and DISABLED     PASS
the hint NAMES what is missing   "needs 9 more: parent_record_id, jobRole, ..."
the Nurture control is labelled  "Nurture"
the dirty indicator hidden clean, and appears as "1 unsaved change"
notes default to the latest 2 of 6         PASS
the follow-up task renders 3 controls      PASS
                                                          13/13
```

**"Side by side" is asserted as EQUAL TOPS, not as both-present.** That is the
Test Bed round's lesson: a count of two cards cannot see a wrap, because
wrapping preserves DOM order.

---

## 3. The P1 rules, rendered

### Qualify reads the server's own derivation

`GET /records/:id/exit-criteria`, which `transitions.js` says computes **"the
exact same `blocking[]`"** the transition itself would. **Verification 43
taken literally**: the surface reads the enforcement's derivation rather than a
second list of required fields.

> **R5 is the proof it would have drifted.** Adding `company` to the gate broke
> a test asserting a second reader of those same rows, and that test had to be
> updated by hand. A client-side list here would have needed the same hand and
> had nothing to catch it.

**A failed read leaves the last known state alone** rather than reporting
"nothing is blocking", which would enable a button the server will refuse.
**The server is still the enforcement**; the button and hint are the surface.

### Nurture is inline, and its reason is a note

The Park form moved **into the header block**, where the action that opens it
lives, rather than at the foot of the page. One instance, not two - the old
placement was removed rather than left beside it. The reason still writes as a
prepended note, which P1 proved and P3 did not change.

### Notes: P1's two carried gaps, closed

`default 2`, expand to `Last 10` and `All`, latest first. The control is **not
rendered when it would do nothing** - a lead with two notes has nothing behind
the fold - and the count is stated, "Showing 2 of 6", so a person knows what
they are not seeing.

**The slice is a WINDOW, not a re-sort**, asserted by checking the newest note
is still first after expanding.

### The follow-up task gets its first surface

P1 built and proved `followUpDate` and `followUpDescription` server-side and
said plainly that nothing rendered them. **Not a `FieldRow`, deliberately**: a
task is two fields saved together, and the shared row would make the date and
the description separately dirty, separately openable and separately
discardable.

---

## 4. THE DOOR HAD MADE AN UNOWNED LEAD UNREADABLE

**The most serious finding of the phase, and it was caused by this phase.**

Collapsing the panels gave them `<button>` toggles. The door disables form
controls. Measured on the live screen:

```
the collapse toggle on an UNOWNED lead:
  disabled: true, pointer-events: "none", opacity: "0.45"
```

**Contact Details and Address could not be opened**, with every field behind
them. That is the door doing the one thing it must never do: **a person who may
not EDIT a record must still be able to READ it.**

### Fixed by a declared property, not a name

`[aria-expanded]` is **what a disclosure IS** - the attribute exists to say "I
show and hide something". Per Verification 19, an exemption enumerates by a
declared property and **fails on the unrecorded instance**: every future
collapsible is covered without anybody remembering to add it, and anything
carrying the attribute is making a claim a reviewer can check.

**One definition, both instruments.** The door exempts the attribute and the
shared enumerator classifies it as a disclosure. **The enumerator also had to
CAPTURE it** - a classifier reading a field the enumeration never produced is
always `undefined`, which reads as "not a disclosure" and **would have silently
reversed the exemption**.

### Calibrated both ways on the redesigned screen

```
record     is-not-mine  controls  write  write-REACHABLE  nav  disclosure alive
not mine   true               43     11                0    1                 2
mine       false              43     11               11    1                 2
```

```
fields    15 present, 0 reachable  |  15 present, 15 reachable
qualify    1 present, 0 reachable  |   1 present,  1 reachable
nurture    1 present, 0 reachable  |   1 present,  1 reachable
addNote    1 present, 0 reachable  |   1 present,  1 reachable
followUp   3 present, 0 reachable  |   3 present,  3 reachable
```

**A6 still passes** on the redesigned screen: the editor refuses to open on an
unowned lead, and returning shows the owner's saved data.

### P2's tripwire fired, on exactly the change it was set for

`followUp` was declared **NOT YET RENDERED** and **shrink-only**. P3's panel
made it `3 present`, the probe went **red** with *"now RENDERS, so the
not-yet-rendered declaration is stale"*, and the entry came out. **It is now
asserted rather than silently uncovered** - which is what the declaration was
for.

---

## 5. The screenshot caught what 13 assertions could not

**Notes rendered as bare text** between two panels while Summary sat in one,
and the ruled panel sizes were the app-wide **10px** rather than 14pt. Every
assertion passed on that screen.

Verification 4. Notes is a panel now, and **the sizes are scoped under
`.cd-panel`** rather than changing `.pg-card-title` for every card in the
application - **that blast radius was not ruled on**, unlike A1's, which was.

The redesign also broke two of the probe's own waits: `innerText` excludes
hidden content, so a collapsed panel took the company name out of the text a
settled screen contains. Both fixed at the site.

---

## What P3 does NOT establish

- **Nothing about the Leads List or the batch grid** - P4 and P5, still blocked
  on their mockups.
- **The A9 consequence is now load-bearing rather than theoretical**: with both
  field panels collapsed by default, the header count is the only thing on
  screen that knows an unsaved edit exists. It is carried, not resolved.
- **No gate run.** That is the round close.
- **Delete and Unqualify are unplaced** - section 1.
- **The follow-up task saves on its own button**, separate from the header
  Save. Two save controls on one screen is a thing to look at when P4 settles
  the card's shape.
