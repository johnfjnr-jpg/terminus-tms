# Leads, P3: the Lead Detail redesign

**Built to the ruled layout and verified 13/13 on the live screen. R7 and R8
ruled at the close and now built, recorded and verified.**
pure 512/512, react 939/939, database 100/100. **Nothing pushed.**

**Re-verified after R8's removals:** layout 13/13, door 0 of 10 write controls
reachable unowned against 10 of 10 owned with **disclosure alive 2 on both**,
and the screenshot read - Delete and Unqualify gone, NAME and JOB ROLE present
and editable.

Every claim below is a **live DOM read after a rebuild**, with
`check-dist-fresh.mjs` passing first. The probe refuses to run on a stale
bundle.

---

## 1. R7 and R8, ruled and closed

The two findings P3 raised were ruled at the close. Both are now built,
recorded and verified.

### R7 - every gated field has a reachable editable input

`jobRole` is a Contact Details row. The lead name is **editable**: the heading
displays it and the row satisfies the gate.

**Proven, not asserted.** `probe-gated-fields-reachable.mjs` takes its
population **from the server** - `GET /records/:id/exit-criteria`, the same
derivation the gate uses - so it cannot pass against a stale copy of the
requirements. **A 16th gated field added by a migration tomorrow, with no row,
turns this red.**

```
gated at Qualify, per the server: 15
13 rows: present, opens, accepts typing
 2 declared as satisfied elsewhere, each naming its surface:
     parent_record_id -> the Account card
     industry_id      -> the Industry row, keyed by column name
```

> **"Reachable" means OPENED AND TYPED INTO, not present in the DOM.** A row
> inside a collapsed panel counts because the panel opens, and the probe opens
> it - part of the claim rather than a shortcut. A row that renders and refuses
> to open does not count, **which is exactly what P3's own door bug was.**

### R8 - the lifecycle is forward-only, and leads are not deleted here

Recorded in the brief **and** in `DESIGN_PRINCIPLES.md`, as a rule:

> - **Leads are NOT deleted from the Lead screen at this stage.**
> - **The lifecycle is FORWARD-ONLY:** created `Unqualified`, then `Qualified`
>   or `Nurture`. **No transition back to `Unqualified`.**

**Recorded as a rule because both controls existed in the vanilla** and were
ported deliberately after an accounting instrument found them missing. That
port was correct at the time. *"The vanilla had them"* is exactly the argument
that would restore them, so the supersession is written where somebody would
look.

**The handlers are gone, not merely uncalled.** An orphaned `unqualify` would
be the first thing a later reader found when asking how a lead gets
unqualified - answering a question the lifecycle no longer asks.

**Five tests inverted, not deleted.** A deleted test leaves the controls
unguarded in *both* directions. One of the replacements checks a **Qualified**
lead specifically, because U3 only ever offered Unqualify on a non-Unqualified
record - a test checking only the Unqualified case would pass against the old
code too.

### FLAGGED, NOT BUILT: the transition is still open server-side

**Measured, not inferred:**

```
POST /records/:id/transition {to_stage:'Unqualified'} on a Qualified lead
  -> 200 ACCEPTED, and the record moves
```

`transitions.js` permits **any backward transition by design**, and its own
comment records that whether a reversal needs a reason or an entitlement is a
live question - **the same governance question as approval entitlement**.

> **So the rule is currently enforced by the SCREEN and not by the server.**

That is a weaker guarantee than this estate usually accepts, and it is stated
plainly in `DESIGN_PRINCIPLES.md` rather than left to be discovered: anything
that can reach the transition endpoint can still reverse a lead.
`DELETE /contacts/:id` is likewise untouched. **The item for a later round:**
refuse, gate on an entitlement, or allow with a recorded reason - and the same
answer probably governs every record type.

## 2. The layout, verified## 2. The layout, verified

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
- **Whether the reverse transition should be closed server-side** - flagged in
  section 1, not built.
- **The follow-up task saves on its own button**, separate from the header
  Save. Two save controls on one screen is a thing to look at when P4 settles
  the card's shape.
