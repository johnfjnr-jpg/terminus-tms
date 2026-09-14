# R1 Contact detail surface swap, Phase 1: STOPPED, and the measurement is why

---

## 1. WHAT IS NOT BUILT

**The swap is not built. Nothing was shipped. The tree is byte-identical to
the Phase 0 commit** except one new document, the behaviour contract.

**No test was re-pointed.** R6's named job is not started, deliberately:
re-pointing 17 cases onto a shape the business has not chosen would be the
proxy fault this round was created to avoid, at three times the cost of
finding out first.

**I began the build and reverted it.** Three edits landed on `ContactHost`
(the import, the option fetch, the state) before the prop measurement below
stopped it. Reverted from `HEAD` and verified byte-identical - `HEAD` is the
pre-edit state here because Phase 0 was read-only, which was checked rather
than assumed (V44).

---

## 2. THE FINDING: THIS IS NOT A SWAP. IT IS A LAYOUT REBUILD

**Measured, not reasoned:**

| | props | composition slots |
|---|---|---|
| `ContactPanel` | **16** | **9** |
| `QualifyCompletion` | 15 | **1** (`accountActions`) |

`ContactPanel`'s nine are `onBack`, `actions`, `linkPanel`, `notes`,
`status`, `leadName`, `followUp`, `nurturePanel`, `qualifyBlockers`.

> **`ContactPanel` is not a field renderer. It is the SCREEN'S LAYOUT**, and
> it composes the back button, the stage actions, the link panel, the notes
> history, the 18pt name heading, the follow-up task, the park form and the
> server's outstanding-requirements hint.

**`QualifyCompletion` has no equivalent for any of the nine.** Substituting
one for the other does not move a field surface; it **removes nine screen
concerns and rebuilds the layout**, which is a different act from the one
R1 describes and a much larger one.

**This is Verification 49's own clause arriving one level up.** Round B
censused the capabilities `ContactHost` RENDERS and found four unnamed. **A
capability can also live in a SLOT** - a prop the host fills and the
replacement has nowhere to put - and no census of either component's own
markup reaches it.

## 3. AND THE SECOND MEASUREMENT, WHICH POINTS THE OPPOSITE WAY TO THE GOAL

The round's goal says **"one record view, the standard enforced."**
Measured, the estate's record-detail standard is `FieldRow`:

| surface | field idiom |
|---|---|
| `AccountView` | **`FieldRow`** |
| `ReferenceHost`, `ReferencePanel` | **`FieldRow`** |
| **`ContactPanel`** | **`FieldRow`** |
| `QualifyCompletion` | `LeadFieldInput` - a bare always-open `<input>` / `<select>` / `<textarea>`, no display mode |

> **Contact detail is already the conforming surface.** Moving it onto
> `QualifyCompletion` would make it the only record-detail screen in the
> estate with fifteen always-open inputs and no display state.

**R2 requires it to "render cleanly for a complete record."** `mode='view'`
drops the eyebrow - that is one line and it works - **and the fifteen inputs
are still open.** Dropping the framing is not the same as rendering cleanly,
which is Verification 26 exactly: the clause after "so" is its own claim.

**`QualifyCompletion` is correct for its own job.** It is a completion form:
every field open, prefilled, marked where the server says blocking, for fast
entry of what is missing. That is a good design for completing a lead and it
is not a detail view.

## 4. AND INTERACTION_STANDARDS NAMES `ContactHost` BY NAME

Section 5 records the four discard-dialogue sites as *"`LinkAccountPanel`,
`StageActions`, `NotesHistory` and `ParkForm`, all rendered by
`ContactHost`, which passes each of them the shared discard dialogue through
the shell's `confirmDiscard`."*

**Retiring `ContactHost` falsifies a maintained standards document**, which
`scripts/tests/standards-staleness.test.mjs` reads. That is not a blocker -
the document can be updated - but it is a fourth thing the retirement
touches that no ruling names.

---

## 5. What IS delivered

**`CONTACT_SURFACE_CONTRACT.md`** - 23 behaviours, written **before** any
code, stated as requirements about the screen rather than descriptions of a
component. It is deliberately silent on which component renders them and on
the interaction idiom, because those are the decisions this report is
stopping for.

**It is the artefact R6 needs.** Verification 47's component clause: a
replacement and its tests derived from the source being replaced agree with
themselves. Whatever shape is chosen, the re-pointed tests derive from this
document.

**Two of the 23 are new and are this round's own**: C21 (no completion
framing when nothing is missing) and C23 - *the mode governs framing, the
server governs marks* - which is Round B's own recorded fault written down
as a requirement so the next build cannot repeat it.

---

## 6. THE FORK, and it is the business's to take

**Every option preserves all capabilities. None is blocked by anything other
than the decision.**

- **(a) BRING THE LEAD CARD UP TO THE STANDARD.** The inverse of R1. Contact
  detail already conforms; the leads card is the outlier. Cheapest in
  capability risk, and it makes "one record view, the standard enforced"
  true in the direction the measurement points.
- **(b) GIVE `QualifyCompletion` A DISPLAY IDIOM** in `mode='view'`, then
  swap. Makes the shared surface genuinely serve both jobs. Real work on a
  component the leads surface depends on, so it needs its own calibration.
- **(c) SWAP THE FIELD CARDS ONLY** - `ContactPanel` keeps its sixteen props
  and its nine slots, and renders `QualifyCompletion` where its own field
  cards are. Preserves the layout, still changes the idiom to always-open,
  and produces two save controls on one screen unless one is removed.
- **(d) FULL RETIREMENT AS WRITTEN.** Needs R4 ruled, plus homes for Qualify,
  Park and the account's own details, plus an `INTERACTION_STANDARDS` §5
  update, plus 54 cases re-pointed. **That is not one phase.**

**R4 still cannot be executed as written** under any of them - the create
actions are on the retiring screen, not the Contacts list - and that ruling
is needed for (d) regardless.

---

## 7. What this report does NOT establish

- **Nothing was screenshotted.** The build was reverted before it rendered,
  so the "renders cleanly" claim in section 3 rests on the component's
  source - `LeadFieldInput` returns a bare input with no display branch -
  **not on looking at it.** That is weaker evidence than V4 asks for, and it
  is named rather than dressed up. **Option (b) or (c) should be looked at
  before being chosen.**
- **No claim that Round B's reverted R1 was wrong.** It reported "it works"
  and was never screenshotted either. What this phase adds is the prop
  measurement, which Round B did not take.
- **The 24 surviving test cases are not audited**, only classified.
