# UI STANDARDS, Phase 0: the inconsistency inventory

Read-only. Two instruments, both calibrated, plus a live probe at 1920.
Captures in `.verify/uis/`, log in `.verify/uis-p0.log`.
`check-dist-fresh.mjs` PASS before the live read.

---

## The headline: FIVE save-control placements, not three

The brief says three. **Measured across every surface the card can open,
it is five**, and the two extra are the overlays.

| placement | panels |
|---|---|
| **ON THE HEADER LINE** | **Notes** - the only one that conforms |
| BELOW THE FIELD | **Summary**, Address popup, Nurture dialogue |
| BESIDE THE FIELD | Account picker |
| FOOTER ROW | Follow-up task **[frozen]** |
| n/a - an action group, not a field panel | Card actions |

**Conformance to the standard as it stands:**

| | |
|---|---|
| header on ONE line | **2 of 8** |
| a DISCARD present | **4 of 8** |
| panels holding unclassed controls | **3 of 8** |
| distinct save placements | **5** |

**Every claim is a relationship**, per the standing instruction: save-vs-header
and save-vs-panel-right for S1, title-vs-secondary-vs-actions for S2,
field-vs-header for S3. No property of a single element is offered as
evidence about a layout.

---

## 1. The per-panel inventory

### SUMMARY - the clearest violation
- **S1: Save sits BELOW the field**, `save.top 573` against `field.bottom
  567`, and **314px from the panel's right edge** rather than against it.
- **S2: no action on the header line at all.** The header is a title and
  nothing else.
- **S3: 0px.** Conforms - the field aligns to the header.
- **S4: dirty behaviour CONFORMS** (disabled true, then false on an
  edit), **but there is NO Discard.**
- **S5: both controls classed.**

### NOTES - the reference pattern, and it already conforms
- **S1: ON the header line**, `save.top 484` equals `header.top 484`, and
  **0px from the panel's right edge** when closed.
- **S2: YES** - title, `LATEST FIRST`, Add note and Discard on one line.
- **S3: 0px.** **S4: conforms, and Discard is present.** **S5: all six
  classed** (`btn-sm`), retired from F3 last round.

### FOLLOW-UP TASK - frozen, and the worst of the three
- **S1: a FOOTER ROW**, `save.top 564` beside fields ending at `585`.
- **S2: NO** - the title has its own line above a two-field body.
- **S4: dirty conforms; no Discard.**
- **S5: THREE unclassed controls** - `cd-followUpDate`,
  `cd-followUpDescription`, `cd-followup-save`. **The screenshot shows
  "Save task" as a white browser default and both inputs as native.**
- **AND IT IS BOXED** while Summary and Notes are not: it carries
  `.cd-card`, a different panel shell.

### The overlays
- **ADDRESS POPUP**: save below the field, header not one line, **6
  unclassed controls**, Discard present (Close).
- **NURTURE DIALOGUE**: save below the field, header not one line, **2
  unclassed controls** (`nurture-date`, `nurture-reason`), Cancel present.
- **ACCOUNT PICKER**: **BESIDE the field** - which is correct for a
  create-from-input control and is C3, the convention written last round.
  All controls classed.

---

## 2. Shared components: THERE ARE NONE. Each panel is bespoke.

**No component named `Panel`, `PanelHeader`, `SaveControl` or
`CardHeader` exists.** What exists instead is **three competing panel
shells expressed as CSS classes**:

| shell | used by | shape |
|---|---|---|
| `.card-col-head` | Notes, Summary | a header line, added last round |
| `.cd-card` / `.cd-card-head` / `.cd-card-title` | **Follow-up task**, ContactPanel | a boxed card with a title line |
| `.eyebrow` + `.form-actions` | Address popup, Nurture dialogue | a modal with a footer |

**That is the structural root of the inconsistency.** The panels are not
inconsistent because somebody was careless; they are inconsistent because
**there was never one thing to build them from.**

### RECOMMENDATION: NEW shared components, not conformed existing ones

Conforming three shells individually leaves three shells that agree
today - **Verification 20's shape at the component level, and it is what
produced this round.** One `PanelHeader` plus a panel container, and the
panels compose them.

**What a `PanelHeader` needs, derived from the eight panels measured:**
title; an optional secondary label; an optional actions slot,
right-aligned; a fixed line height so C2's alignment holds by
construction; and **no knowledge of what its panel contains.**

**And a save-control pair** - Save plus Discard, with the dirty state
passed in - because S4 says the same everywhere and four of the eight
panels currently implement "the same" differently.

---

## 3. The three-consumer constraint

| component | consumers | frozen reach |
|---|---|---|
| **NotesHistory** | card, **ContactHost**, **TestBedHost** | **the three-consumer case John names** |
| **FollowUpTask** | card, **ContactHost** | **frozen AND shared** |
| **LeadFieldInput** | AddressPopup, QualifyCompletion, **NewLeadGrid** | not frozen, but reaches the New Lead grid |
| InlineSummary, AddressPopup, AccountPicker, QualifyCompletion, NurtureDialog, LeadCardActions | card only | free to change |

**Two constraints rather than one.** `NotesHistory` is the case the brief
names and it already conforms, so it needs optional props only if the new
`PanelHeader` replaces its header.

**`FollowUpTask` is the sharper one: it is FROZEN by ruling AND shared
with Lead Detail**, and it holds three of the ten unclassed controls.
**S5 says retire F3 on the lead card; the freeze says do not touch this
panel.** That conflict is a decision below.

**`LeadFieldInput` is a third case the brief does not name.** Classing
its five controls also changes the **New Lead grid**, which is not a card
surface. Not frozen, so not blocked - but it is a visible change outside
the retrofit's stated scope.

---

## 4. S5 and F3: the full inventory

**10 unclassed control declarations rendering 11 live instances**, and
**three competing button treatments among the 24 that are classed.**

| where | unclassed | note |
|---|---|---|
| `LeadFieldInput` | **5** | 3 selects, a textarea, an input - render 6 cells in the address popup |
| `FollowUpTask` | **3** | **frozen** |
| `NurtureDialog` | **2** | `nurture-date`, `nurture-reason` |

**The classed controls are not consistent either.** S5 says **one button
treatment**; the card has **three**: `.btn-ghost` (7), `.btn-sm` (7),
`.btn-primary` (4).

### The undefined CSS vars

| var | use sites | every one carries a literal fallback |
|---|---|---|
| `--red` | 3 | yes, `#e06c6c` |
| `--amber` | 10 | yes, `#E0A33E` |

**They render correctly today and are invisible to the palette.**
**Recommendation: define them at the values already in use**, so the fix
changes nothing visually and everything structurally.

---

## 5. What the written contract should contain

Derived from what the eight panels disagree about, not from a template:

1. **Panel anatomy** - container, header line, body. **No footer.**
2. **The header line** - title left, secondary beside it, actions right,
   one line, fixed height. Supersedes and absorbs C1 and C2.
3. **Field alignment** - the first field's left edge equals the header's.
4. **Dirty semantics** - Save disabled until dirty; Discard reverts to
   the loaded value; both live in the header's action slot.
5. **A control treatment table** - which class for which role, so "one
   button treatment" is a lookup rather than a judgement.
6. **The modal exception, stated explicitly** - see the decisions below.
7. **How a SHARED component takes the standard** - optional props, and
   the frozen-consumer rule.
8. **How it is ENFORCED.** This is the half that makes it a standard
   rather than a document.

### The enforcement recommendation

**A conformance test over a registry of panels, measuring S1 to S5 as
relationships in the live DOM - which is the probe this phase already
wrote.** Promoted into the gate, a new panel that puts Save below its
field fails a test rather than waiting for a walk.

**That is the round's actual deliverable against its stated purpose.** A
contract nobody can fail is C5's empty-state sentence at document scale.

---

## Decisions Phase 1 needs

1. **MODALS: in or out of S1?** S1 says header line; **both modals put
   actions in a footer**, which is near-universal convention for a
   dialogue. **Recommended: the contract states a modal as an explicit
   distinct shape** - actions in a footer row, right-aligned, Save then
   Discard - rather than S1 being silently violated twice. **This is the
   one place the standard as ruled does not cover what is on the card,
   and it is yours rather than mine.**
2. **FollowUpTask: frozen wins, or S5 wins?** It is frozen by ruling and
   holds three unclassed controls. **Recommended: the freeze wins** and
   the three carry to the follow-up entity round, which rebuilds that
   panel anyway. The report states them so they are not lost.
3. **LeadFieldInput's five**: classing them also changes the New Lead
   grid. **Recommended: class them** - they are the address popup's
   controls and F3 is the target - and state the grid change.
4. **New shared components** rather than conforming three shells.
5. **`--red` and `--amber` defined at their existing fallback values.**
6. **The conformance test goes in the gate**, so the standard is a
   control rather than a claim.

---

## What surprised

**The population had to be corrected twice, and the second time it was
the live probe that caught the static one.**

The census first rooted at `LeadCard` and followed every import - which
dragged in `LinkAccountPanel`, a component the card **stopped rendering
last round**, and counted its five controls as the card's. Narrowed to
components actually used as JSX.

**Then the live probe found two unclassed controls the census could not
see.** `NurtureDialog` is opened by a button on the card and **rendered
by the LIST**, so a census rooted at the card is blind to it by
construction. **Verification 49's clause - a view is every file that
writes into its container - and it cost nothing only because two
instruments disagreed.**

**And the measurer was wiped by its own probe's reloads.** Injected with
`page.evaluate`, it vanished on the first reload and the three overlay
surfaces died on "not a function". Re-attached with
`evaluateOnNewDocument`, which is Verification 45's remedy arriving on a
helper rather than on a sampler.

---

## What this does NOT establish

- **Nothing about how the retrofit will look.** Every number is the card
  as it stands.
- **Only 1920 was measured for the inventory.** The retrofit's own
  verification is at all three widths; the inconsistency is structural
  and does not need three widths to establish.
- **The other surfaces are unmeasured.** Contacts, Test Bed and Lead
  Detail were not inventoried; the contract governs them when touched.
