# Phase 1 addendum: the LOOK, and it corrects my own report

Three screenshots at **1440**, plus a live DOM census beside each. **No
direction is picked here** and nothing was built: the fork is John's.

Artefacts in `.verify/contact-swap/`:
`completion-today-1440.png` · `completion-viewmode-1440.png` ·
`completion-full-1440.png` · `contact-detail-today-1440.png`

---

## 1. THE CORRECTION I OWE

**My Phase 1 section 3 said the swap would make contact detail "the only
record-detail screen in the estate with fifteen always-open inputs", resting
on reading `LeadFieldInput`'s source. Having looked, that framing was
one-sided and the implied conclusion does not hold.**

**The completion surface is not a wall of inputs.** It is a **four-column
labelled grid**, two titled groups, **431px tall for fourteen fields**, with
missing-required marked by a green asterisk. It is dense, scannable and
reads well.

**And the measurement I did not take is the one that matters:**

| at 1440, on load | completion surface | contact detail |
|---|---|---|
| record fields **visible** | **14** | **0** |
| field rows in the DOM | 0 | 15 |
| surface height | 431px | 876px |
| cards | 1 | 11 |

> **Contact detail shows ZERO of the record's fields on load.** Contact
> Details and Address Details are **collapsed by default** - deliberately,
> per `ContactPanel`'s own comment citing the ruled layout. What you see is
> Summary, Notes, Account and Follow-up Task, and two closed headers with a
> `+`.

**So on the narrow question "which surface shows the record", the completion
surface wins outright, and my report implied the opposite.** The idiom claim
stands - `FieldRow` is the estate standard, used by Account, Reference and
Contact - **but conforming to the standard and showing the data are two
different things, and I ran them together.**

## 2. `mode='view'` IS EXACTLY ONE LINE, MEASURED TWO WAYS

Injected in `LeadCardActions`, rebuilt, photographed, reverted, **restore
verified byte-identical and the bundle rebuilt clean**.

| | `complete` | `view` |
|---|---|---|
| eyebrow | "Please complete missing data" | **null** |
| height | 431px | **404px** |
| visible inputs | 14 | 14 |
| asterisks on missing fields | present | **present** |

The 27px delta is the eyebrow's own height. **Nothing else moves**, which
agrees with the source: `mode` is referenced three times in the component -
the destructure, the type, and line 225.

**And C23 is confirmed working**: the marks survive view mode, because the
server's blocking list governs them and the mode governs only framing. That
is Round B's recorded fault not recurring.

## 3. THE FORK'S OWN QUESTION, PHOTOGRAPHED

`completion-full-1440.png` is a **fully populated** record on the completion
surface - every field the surface renders filled, only `summary` outstanding
(which is edited elsewhere by R3's mark-don't-point rule). **That is the
closest the current build can come to "this surface as a detail view of a
complete record" without building the swap**, and it is the image the fork
turns on.

It reads as a clean, complete, four-column record card. **What it is not is
a SCREEN**: no back, no stage actions, no notes, no account, no follow-up.
Those sit outside it, on the lead card, which is the nine-slot point from
the main report and is unchanged by looking.

---

## 4. A LIVE DEFECT FOUND BY LOOKING, and it is not this round's to fix

**The Industry picker on the completion surface reads `--` on a record that
has an industry.** Visible in all three completion shots.

Confirmed live rather than inferred:

```
contacts returned: 17    with a top-level industry_id: 17
same key inside payload?  false
payload has "industry"?   false
LeadCard.tsx:87   const p = lead.payload ?? {}
LeadCardActions.tsx:196   current={payload}
```

`industry_id` is a **column**; the surface is handed the **payload**. **So
the picker can never prefill, for any lead, ever.**

**And the display disagrees with the enforcement**: Industry carries **no
asterisk** in the shots, because the server correctly sees `industry_id`
set - so the screen says "not chosen" about a field the gate says is
satisfied. That is Verification 43's family, a display reading a different
source from the enforcement.

**It is the same `industry` / `industry_id` seam Phase 0 measured from the
save side**, arriving from the read side. **On the list under rule 10** - my
change did not create it - **and it is load-bearing for the fork, because
options (b), (c) and (d) all inherit this surface.**

---

## 5. Stated plainly, as asked

- **R4 still blocks full retirement (d).** The create actions are in
  `StageActions.tsx` alone, rendered by `ContactHost` alone, and the Contacts
  list view holds exactly one button, the Mine toggle. Unchanged by the
  screenshots.
- **`INTERACTION_STANDARDS` §5 names `ContactHost` by name**, as the renderer
  passing the shared discard dialogue to `LinkAccountPanel`, `StageActions`,
  `NotesHistory` and `ParkForm`. **(d) touches a maintained standard**, which
  `standards-staleness.test.mjs` reads.
- **Nothing was built, no test was re-pointed, no direction is picked.**

## 6. What the screenshots do NOT establish

- **Contact detail was shot as a NON-OWNER.** 0 of 11 Qualified contacts are
  owned by the probe identity, so its controls are correctly greyed and its
  rows are not in their editable state. **An owner's view was not
  photographed.** The collapsed-by-default finding is unaffected - the door
  does not collapse cards - but a parity judgement would need the owner view.
- **The completion surface was shot on a FIXTURE**, created through the route
  and **soft-deleted afterwards, enumerated from the database by tag, 3 found
  and 0 left live**. The probe identity owns none of the 6 live leads, so the
  door neutralises Qualify on every one and the surface could not otherwise
  be opened.
- **1440 only**, as asked. Nothing at 1240, 1920 or 3440.
- **No claim about which surface is better.** Two of the measures point
  opposite ways - the standard says contact detail, data visibility says the
  completion surface - and that tension is the fork rather than its answer.

---

## 7. THE GATE CAUGHT MY OWN PROBE

`api-client.test.mjs` refused the first commit of this addendum:

```
no script calls fetch directly except the two that are allowed to
these bypass the throwing client, so a non-2xx there is silent again
```

`shot-completion.mjs` had its own `fetch` helper. **The fix was to route it
through `scripts/api-client.mjs`, the estate's throwing client, not to add an
exemption** - Verification 9's ratchet clause, a one-way control's refusal is
information about the probe rather than an obstacle in front of it. Same
result after the change, so the reading is unaffected.

**Two of the four probes written this phase were then deleted rather than
kept**: `diag.mjs`, which answered the door question and has no further job,
and `shot-surfaces.mjs`, superseded by the two that work. P5's unwired-probe
condition is a standing item, and adding three dead files to it to look
thorough would be the wrong direction.
