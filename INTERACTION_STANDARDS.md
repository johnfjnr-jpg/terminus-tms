# Terminus Management System: Interaction Standards

**Status:** MIXED, and it is now recorded per section rather than per document. See the classification table below.

**Corrected Round 29 Phase 1, 2026-08-24.** This line previously read "Specification only, not yet implemented", and that was false by the time anyone read it: Section 4's focus trapping is referenced on 42 lines of `frontend/*.js`, Section 3's `.msg-error` treatment on 35, and Section 5's own body names three working implementations. Only Section 5's system-wide dirty-state registry is genuinely unbuilt. A status line that says "none of this exists" about a document describing things that do exist is worse than no status line, because it invites a reader to skip the parts that are load-bearing.

**This document also now records what is BUILT and was never specified**, which it had no home for before. Round 29 exists because three times the business has been asked to screenshot Test Bed so a pattern could be learned. A convention that lives only in the product and in one person's memory is re-derived, and Round 28 recorded nine instances of a fix built for the screen that existed at the time, every one of them a pattern nobody had written down. This is the concrete spec that DESIGN_PRINCIPLES.md's Deferred scope entry for "Tab/Enter field navigation and unsaved-changes-on-navigate warnings" points to, written now so that work has a real target to build against when it's picked up, same discipline as extracting the prototype before building (DESIGN_PRINCIPLES.md Section 3, rule 8): write down what "correct" concretely means before writing any code against it, not after.

**Why this is its own document, not folded into DESIGN_PRINCIPLES.md or a prototype-extraction spec:** DESIGN_PRINCIPLES.md records confirmed product and data-model decisions. A prototype-extraction spec records what `Terminus Ops.dc.html` actually does, cited by section and line. (**Corrected 2026-09-13**: this previously cited the same name with underscores in place of the space and the dot, which resolves to nothing. Found by the staleness check on its first run - an unresolvable citation sitting in the paragraph that explains why this document is trustworthy. The wrong spelling is described here rather than quoted, because quoting it would reintroduce the very citation the check is looking for.) Neither fits here: this isn't a product decision, and the prototype has no real forms or Tab/Enter handling to extract from at all, confirmed directly against its source. This is general professional interaction-design practice, external to this project, sourced from two published standards below, and applied concretely to this app's real screens and field IDs, not just linked to.

---

## Sources

- **GOV.UK Design System** (https://design-system.service.gov.uk), reference implementation **govuk-frontend** (https://github.com/alphagov/govuk-frontend). Used here for the **error summary pattern**: https://design-system.service.gov.uk/components/error-summary/. On a failed form submission, an error summary listing every validation failure appears above the form; each item is a link to its corresponding field; focus moves to the summary itself on submission failure, not to the first invalid field, so a screen-reader user hears the full list of what's wrong before landing on any one field.
- **WAI-ARIA Authoring Practices Guide (APG)** (https://www.w3.org/WAI/ARIA/apg/). Used here for general keyboard interaction conventions (https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) and the Dialog (Modal) pattern's focus-management requirements (https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), applied to Park and any future in-page panel that plays the same role even though it isn't a full-screen overlay.

---

## 0. The governing principle: ACTION GOES WITH ITS SCOPE

**Set by the business 2026-09-13. It sits above the numbered sections
because it is what several of them turn out to be saying.**

> **A control sits with the thing it acts on.**

- **Record-scoped actions** - advance the record, save all its fields - live
  on the **record's action bar**. That is Section 6, written from Test Bed in
  Round 29 and true of the lead card without anybody having read it.
- **Panel-scoped actions** - save this Summary, these Notes - live on **that
  panel's header line, right-aligned**.

**These are ONE principle at two scopes, not two standards.** Section 6 is its
record-scope expression and Section 12 is its panel-scope expression. **A new
surface applies it by asking what the action acts on**, which is a question
with an answer, rather than by finding the nearest screen to copy.

**Why it needed writing down.** Measured on one lead card, 2026-09-12: **FIVE
different save-control placements** - below the field, on the header line,
beside the field, in a footer row, and on the record bar - across eight
surfaces, with **no shared component of any kind** and three competing CSS
shells. Every panel was locally defensible. The card was not.

> **The failure mode this exists to end: locally-correct panels, a globally
> inconsistent app, caught only by walking.**

**AND IT IS ENFORCED, NOT ADVISED.** Section 12.

## 1. Tab order matches visual layout, exactly

Keyboard Tab order must match the form's visual top-to-bottom, left-to-right reading order. This is native browser behavior, DOM order, and needs no manual `tabindex` as long as no CSS reorders visual position independent of DOM order (`order`, absolute positioning, out-of-order `grid-row`/`grid-column` placement). Where a layout does need visual reordering, `tabindex` must be re-sequenced to match what's visually presented, keyboard order must never silently diverge from what a sighted user sees, per APG's meaningful-sequence keyboard guidance.

**Concrete example, current state, to be preserved:** the New Lead modal (`frontend/index.html` lines 121-222, rebuilt 2026-08-13 to match `Terminus Ops.dc.html:4854-4956`) lays out via `.form-grid`, a plain two-column CSS grid with no `order` overrides, so DOM order and visual order already match: Name → Company → Industry → Job Role → Email → Mobile → Address Line 1 → Address Line 2 → City → Postcode → Country → Region → LinkedIn → Source → Status → Summary → Notes → Cancel → Save lead. (Previously cited as the old inline form's Name → Company → Industry → Email → Mobile → Country → Region → Source → Save contact order - stale after the rebuild, corrected here rather than left to drift.) This document's requirement is to keep that property true as the app grows, not to change today's order.

## 2. Enter submits the form, except in a `<textarea>`

Pressing Enter inside any single-line field (`<input type="text">`, `email`, `date`, `<select>`) submits the form, the same action as clicking its primary submit button (`btn-save-contact`, `cd-park-save`, and equivalents added later).

Pressing Enter inside a `<textarea>` (e.g. `cd-park-reason`) inserts a newline and does not submit, matching native multi-line-field behavior. This is a widget-specific distinction, not a blanket global Enter-submits-everything binding, consistent with APG's keyboard-interface guidance that a key's effect depends on the widget that has focus.

## 3. Errors: a summary at the top, plus inline per field, never a modal or toast

On a failed submission:

1. An error summary appears at the top of the current form or panel (not the page, these are inline forms and panels, not separate pages), titled to state a problem exists, listing every failing field as a link.
2. Each linked item, when activated, moves focus to its corresponding field.
3. Each field also gets its own inline error text directly beneath it. Both together, summary and inline, GOV.UK's actual pattern is both at once, not either/or.
4. On submission failure, focus moves programmatically to the error summary itself (a `tabindex="-1"` container, `.focus()` called on it), not to the first invalid field, so the full list of problems is available before the user lands on any one of them.
5. This is the standard for discrete, one-shot form submission, submit, see everything wrong at once, work through the list. It replaces any modal, toast, or `alert()`-style validation error for that kind of interaction, wherever one exists today or gets added later.

**Confirmed, deliberate exception: the Contact/Lead qualification gate.** `contact-detail.js`'s `.field-blocked` highlighting, a subtle tint directly on each missing or invalid field, no summary, no banner, no programmatic focus-shift to a summary container, is not this pattern, and that's correct, not a gap to close. An earlier version did have a summary-style banner ("N fields open, M changed"), and it was deliberately removed, more than once revisited and reconfirmed removed, specifically because the interaction it serves is structurally different from a one-shot submission: qualification is a **persistent, continuously-recomputing state** tied to one specific gate, not a discrete submit-and-review moment. Fields clear individually, in real time, as they're fixed, there is no single "submission" event a summary could meaningfully attach to. Rule 5 above still governs anywhere a genuine discrete-submission validation exists or gets built; this exception is scoped specifically to live, recomputing gate states like this one, not a general license to skip the summary pattern elsewhere.

**A second, related exception, added 2026-08-16: Account resolution auto-opens as an action panel, not a summary item.** Within the same qualification gate, most blocked fields (LinkedIn, Job Role, and so on) stay on the passive `.field-blocked` tint described above, no change. Account is different: since `parent_record_id` requires a genuine reconciliation action (search an existing Account or create a new one), not just typing a value into a field, the qualification attempt now auto-opens the existing Account reconciliation panel directly whenever Account is among the blocking fields, pre-filled from the typed Company text. Confirmed live that this doesn't swallow the other exception's own behaviour: a Contact blocked on Account plus another field shows the auto-opened panel *and* the other field's normal `.field-blocked` tint simultaneously, resolving Account closes only that panel, the remaining block stays visible until separately fixed. Same underlying reasoning as Park's own exception status, an interrupting action distinct from ordinary field entry, applied to a second, genuinely similar case rather than invented fresh.

## 4. Focus trapping in in-page dialogs, e.g. Park

Park (`frontend/index.html`, cd-park-date/cd-park-reason/cd-park-cancel/cd-park-save, line numbers not re-cited here since this page has had several rounds of edits since this document was first written, layout, notes repositioning, header changes, verify the current lines against the live file rather than trust a number here) is an inline panel, not a full-screen overlay, but it functions as a dialog: opening it interrupts the row it belongs to and demands a decision before anything else on that row makes sense. Applying APG's Dialog (Modal) pattern:

- On open, focus moves to the panel's first focusable field (`cd-park-date`).
- Tab and Shift+Tab cycle only through the panel's own focusable elements, date → reason → Cancel → Save & park → back to date, not out into the rest of the page behind it.
- Escape closes the panel (same effect as Cancel) and returns focus to the control that opened it (the row's Park button).
- This applies to any future in-page panel that plays the same role as Park, an inline decision point that should behave like a dialog, not just to Park specifically.

## 5. Unsaved-changes warning: real navigation only, never the app's own post-save redirect

The dirty-state registry (DESIGN_PRINCIPLES.md, Deferred scope) warns on genuine navigation away from unsaved changes: a nav-bar link click, browser back/forward, or closing/reloading the tab (`beforeunload`).

It must **not** warn on the app's own post-save redirect, for example a successful Park save calling `loadContactDetail()`, or a successful create calling `navigate('leads')`. Concretely, this means the dirty flag must be cleared explicitly at the moment a save call succeeds, before whatever `navigate()` call the app itself makes next runs, rather than trying to infer after the fact whether a given navigation was user-initiated. By the time a post-save `navigate()` fires, there is no reliable signal left to distinguish it from a real user click unless the flag was already cleared first.

**Two real, working examples now exist: New Lead, and Park (Section 4's own dialog example), which now has both halves of this pattern, not just the focus trap.** Both implement the same two-mechanism split, deliberately different mechanisms for two genuinely different situations, not one mechanism reused for both - conflating them would be a real design error (a refuse-and-nudge on an intentional Cancel would make Cancel non-functional while dirty; a silent-discard on an accidental backdrop-click would lose data the user never meant to abandon):

- **Accidental dismissal (backdrop-click) → refusal plus a nudge, not a choice.** Clicking outside the modal while dirty doesn't close it at all: the modal stays open, Save gets `.btn-attention`, and "You have unsaved changes, save or cancel." shows via `.msg-warning`, auto-scrolled into view (`scrollIntoView({behavior:'smooth', block:'nearest'})`) so it's visible even if the user was scrolled elsewhere in a long form. No second click, no confirmation, the click is simply refused - the premise is that a backdrop-click was probably a misclick, not a real decision to leave.
- **Intentional leave actions (Cancel, the close X, Escape) → confirm-and-discard, a real choice.** These are deliberate "I want to leave" actions, so refusing them outright would make Cancel itself non-functional while dirty. Instead, while dirty, each opens the same shared discard-confirmation dialog (`#discard-confirm-modal`, `openDiscardConfirm`/`closeDiscardConfirm`, defined once in `frontend/app.js` and reused by both modals rather than duplicated - the strongest guarantee they can't drift apart): "Discard unsaved changes?" with two explicit choices, **Discard** (`.btn-ghost`, de-emphasized - closes for real, data lost, now an informed choice) and **Keep editing** (`.btn-primary`, prominent and focused by default - returns to the form, nothing lost). Escape and clicking the confirmation dialog's own backdrop both map to Keep editing, never Discard, so no destructive action can ever happen from an ambiguous input. While this dialog is open, the parent modal's own Tab/Escape keydown handler goes inert (checked at the top: `if (discardConfirmIsOpen()) return`), so a single Escape press can't fire both handlers in the same tick. When the form is clean, all three still close immediately, exactly as before this pattern existed - the guard only activates once there's something real to protect.

**RECONCILED 2026-09-13, and the correction is worth more than the names.** New Lead's implementation still lives in `frontend/app.js` (`newLeadDirty`, `openNewLeadModal`, `requestCloseNewLeadModal`), now hosting the batch grid rather than a form: the container id changed from `new-lead-modal` to `new-contact-form` and the function mounts `mountNewLeadGrid`. **Park's moved.** It was written in `frontend/contact-detail.js`, which the migration RETIRED, and it now lives in `frontend-react/src/contact/ParkForm.tsx` - rendered by `ContactHost` - with both mechanisms intact: Escape and Cancel leave the way this section describes, a backdrop click while dirty is refused with `btn-attention`, and Tab cycles inside the form.

**So the standard survived the migration. What it did not survive is being built AFTERWARDS.** Measured 2026-09-13, the lead card's two dialogues - the address popup and the nurture dialogue - implemented **none** of Section 4 and one third of Section 5. They were built after the migration, by people reading the screen rather than this document, and nothing existed that could have told them. That is what the conformance gate and this section's new Part-two entry are for. Neither is the system-wide dirty-state registry this section specifies, and neither has any connection to real page navigation at all - they're a working proof that the underlying idea, don't silently discard real unsaved input, holds up in two small, real cases (now with two distinct, correctly-matched mechanisms within them), for whenever the full system-wide version gets built.

**A third working example, Round 3, 2026-08-16: Opportunity's Est. Close Date reason dialogue.** Built initially with only backdrop-click and Escape as cancel paths, missing Park's full Tab-cycling focus trap. Corrected to match Section 4 precisely once the gap was raised, not accepted as a smaller, dialogue-specific standard, a single Escape-key listener attached only while the dialogue is open and removed on close (the first version had two overlapping Escape owners, a real bug in its own right, fixed as part of bringing this in line), Tab/Shift+Tab confined to exactly the dialogue's own three elements, focus landing on the reason field on open and returning to the control that opened it on close. Also verified, empirically, not just reasoned about, that cancelling this dialogue does not discard an unrelated dirty field edited in the same batched save, dirtying two fields (Est. Close Date and an unrelated field), cancelling the dialogue, and confirming both survived, then genuinely re-saving both to confirm the surviving state wasn't inert leftover DOM rather than something a real save would actually persist.

**A third case, distinct from the two above, confirmed 2026-08-15.** The binary in this section, accidental dismissal versus intentional leave, was written for one dialog's own dismissal. It doesn't fully cover a related but different situation, found when 4 more sites needed the same underlying protection. **RECONCILED 2026-09-13: those four were named in `contact-detail.js`, which the migration retired. The CASE survives and the sites moved** - linking an account, unqualifying, adding a note and saving the park form are now `LinkAccountPanel`, `StageActions`, `NotesHistory` and `ParkForm`, all rendered by `ContactHost`, which passes each of them the shared discard dialogue through the shell's `confirmDiscard`. None of these are a dialog being dismissed at all, they're deliberate clicks on unrelated controls (Link an Account, Move to Unqualified, Add a note, Save & park) that happen to trigger a side-effect reload (`loadContactDetail()`) which would silently clobber a *separate*, unrelated field left open elsewhere on the same page. **Confirm-and-discard is still the right mechanism for this third case, but the reasoning is different, not equivalent to Cancel/Escape's case:** refusing the action outright, the way a backdrop-click gets refused, would block a valid, unrelated action for a reason the user can't see, there's no coherent "Save" button to highlight, since the dirty field isn't part of what the user is actually interacting with. That makes outright refusal worse here than in Park's own dismissal case, not just unnecessary. **Naming this as its own case:** an unrelated deliberate action threatens someone else's unsaved edit elsewhere on the page. Same mechanism as intentional-leave (confirm-and-discard), different reason for choosing it. When the system-wide dirty-state registry gets built, it needs to handle this third case explicitly, not just the original two.

**A real asymmetry within Park's own implementation, confirmed 2026-08-15, RECONCILED 2026-09-13 and now HISTORICAL.** The two sub-mechanisms described here - `requestCloseCdParkForm` relying on the inert-guard while `saveCdParkForm` removed the keydown listener first - were properties of `frontend/contact-detail.js`, which the migration retired. **`ParkForm.tsx` has ONE close path**, so the asymmetry is gone rather than carried. Kept as a record because the warning it ends on is the general one and is still true: a future edit that adds a third way to close a dialogue must account for every path out of it, not only the one it is looking at. **That is now enforced rather than remembered** - see Section 12, where a modal's dismiss control and its Escape key are the same function by construction.

---

## Part two: what is BUILT

**Added Round 29 Phase 1, 2026-08-24. Read from source, not described from screenshots.**

Sections 1 to 5 above describe intended behaviour. Everything below describes behaviour that exists, with a file and line for every statement, so a reader can check it rather than trust it. **Where the code carries a written rationale, the rationale is carried here too**: the reasoning is why these conventions survived, and it is the part that would otherwise be re-derived, usually wrongly.

---

## 6. The record action bar sits at the right end of the tab strip, inside it

**Test Bed, built Round 7 Phase 6.**

`.tb-tab-actions` is the last child of the tab strip element, after the ten stage tabs, at `frontend/index.html`, the `.tb-tab-actions` block. It holds three buttons in this order: `#tb-cancel-all` (`:874`), `#tb-save-all` (`:875`), `#tb-next-stage-btn` (`:876`).

**It is INSIDE the strip, not beside it.** `margin-left: auto` keeps it pinned right regardless of how many stage tabs precede it, and it participates in the strip's `flex-wrap`.

**It replaced two things, not one:** a separate save-bar banner line and a "Stage Transition" section. That is why there is no banner anywhere on Test Bed and no transition section in the stage panel.

**Two feedback elements, deliberately not merged**, `#tb-save-feedback` (`:887`) and `#tb-next-stage-feedback` (`:888`), both directly under the tab row so either is readable without scrolling.

> The rationale, from the markup comment: one reports "your edit was refused", the other "this transition is blocked", and merging them would let the second overwrite the first.

`tb-save-feedback` was moved here rather than deleted with the banner, because `clearTbSaveFeedback()` and `saveTbFields()` both read it with no null guard and removing the element would have thrown on every save.

**Cancel and Save changes appear only when there is something to save.** `updateTbSaveBar()` at `frontend/test-bed-detail.js`, `updateTbSaveBar()`:

```js
const dirtyCount = Object.values(tbEdits).filter(e => e.draft !== e.orig).length
const show = dirtyCount > 0 || tbInvalidFields.size > 0
```

**Two rules that are not obvious from the screen:**

- **An invalid field disables Save outright** rather than letting the value travel to the server to be refused (`saveBtn.disabled = tbInvalidFields.size > 0`).
- **The bar stays visible at dirtyCount 0 while a field is invalid.** The rationale, from the comment: `tb-save-feedback` sits alongside the controls, so hiding them would hide the message explaining the block.

`#tb-save-all` is wired once to `saveTbFields` in `wireTbOnce()` at `frontend/test-bed-detail.js`, `wireTbOnce()`, and drafts live in `tbEdits`, declared at `:15`, which is the same map every other Test Bed field uses.

---

## 7. Next Stage is disabled by two conditions, and neither is what you would guess

**`refreshTbNextStageButton()` at `frontend/app.js`, `refreshTbNextStageButton()` is the ONLY writer of the `disabled` property on `#tb-next-stage-btn`.** There are no other writers anywhere in `frontend/`.

| # | Condition | What the button shows |
|---|---|---|
| 1 | `!nextStage`, the record is at its final stage | label changes to **"Final stage"**, disabled |
| 2 | `!onCurrentStageTab`, the open tab is not `stage-<record.status>` | label stays **"Next Stage"**, disabled |

**Unsaved changes do NOT disable it.** **Unmet exit criteria do NOT disable it.** Recorded explicitly because both are the natural guess and both are wrong: Round 29 Phase 0 was asked to settle this after a rule was stated from one screenshot and corrected from a second, and both readings were wrong. The function references neither `tbEdits` nor any criteria state.

**Unmet criteria are refused at the SERVER and explained in place.** `attemptTransition` at `frontend/app.js`, `window.attemptTransition` posts the transition, and on a 422 with `blocking[]` renders that list into the feedback element it was given. So the button is clickable, the attempt is made, and the refusal names what is outstanding.

> The rationale for condition 2, from the comment above the function: **stage progression happens from inside the stage itself.** The user opens the record's real current stage tab, reviews its criteria and approvals, and progresses from there. This is called a confirmed business rule.

**The two disabled reasons must not collapse into one greyed button.** "Final stage" is terminal and nothing the user does will change it; "not the current stage" is a one-click fix. The distinction is carried by the LABEL, not by a hint: Round 8 Phase 4 removed the explanatory hint ("Open the <stage> tab to progress") and recorded that as a deliberate reversal of half of Round 7 Phase 6, keeping the label difference and losing the one-line explanation of why.

**State is cached in `tbNextStageState`** (`:4217`) and refreshed by `wireTbNextStageButton()` (`:4219`), because the button's enabled-ness depends on the OPEN TAB, which changes without a re-render.

---

## 8. The chevron hover shows a stage's outstanding requirements, for any stage

**Test Bed, built Round 7 Phase 9, `wireTbChevronHover()` at `frontend/app.js`, `wireChevronHover()`.**

Hovering a chevron shows a popup listing that stage's outstanding exit criteria, from `GET /api/records/:id/exit-criteria?stage=<name>`, or "Nothing outstanding."

**It answers for stages the record has not reached, by construction rather than by a special case.** The endpoint's `?stage=` is an override for which stage to compute FROM, and it "never validates whether a reachable stage was requested, only which `stage_gate_rules` rows get looked up" (`src/routes/records.js`, the `/records/:id/exit-criteria` route and the comment above it).

**Four properties that look incidental and are not.** Each was built deliberately and each would be re-derived wrongly:

| Property | Where | Why |
|---|---|---|
| **180ms debounce** before fetching | `TB_CHEVRON_HOVER_DELAY_MS`, `frontend/app.js`, `TB_CHEVRON_HOVER_DELAY_MS` | A pointer sweeps eight chevrons in well under a second. Firing on every `mouseover` would issue eight requests for one gesture, so the fetch starts only once the pointer has rested |
| **A load token** | `tbChevronLoadToken`, used in `hideTbChevronPopup()` at `:1447` and in the handler | Hovering is faster and less deliberate than clicking, so responses arrive out of order. A stale one must never paint. The symptom would be the wrong stage's criteria appearing for a moment and vanishing, invisible to any test that hovers once and waits |
| **`mouseleave` on the WRAPPER**, not the chevron | `:1495` onward | So moving the pointer from a chevron INTO the popup is not a leave |
| **No click handler on the chevron, ever** | same | Confirmed by history in Round 5 Phases 7 and 8: the chevron has never had one, and adding hover must not add click |

**Popup positioning is centred then clamped** inside the wrapper (`positionTbChevronPopup()`, `:1460`), because the strip runs the full page width and a centred popup on the leftmost or rightmost chevron would be clipped at the viewport edge.

**The record identity is read at hover time from the element, not closed over.** Round 18 Phase 1 fixed two faults with one cause here: `#tb-chevron-wrap` is static markup in `frontend/index.html`, `#tb-chevron-wrap`, so its `dataset.wired` survives every navigation, and the popup's cache key was stage name alone. Either alone gives a wrong answer on the second record opened in a page session. **It survived four rounds because it is correct for the first record opened, and every test opens one record.**

---

## 9. Dirty state and save bars: three mechanisms on Opportunity, one on Test Bed

**Recorded as fact, not as a recommendation.** This is the divergence Round 29 exists to converge, and the count is the starting point.

| Record type | Mechanism | Bar | Where the bar sits |
|---|---|---|---|
| Test Bed | `tbEdits` (``frontend/test-bed-detail.js`, `let tbEdits``) | `.tb-tab-actions` | inside the tab strip, ``frontend/index.html`'s `.tb-tab-actions`` |
| Opportunity, Reference | `refEdits`, via `updateRefEditBar()` (``frontend/opportunity-reference.js`, `updateRefEditBar()``) | `#ref-edit-bar` | inside the Reference panel, ``frontend/index.html`, `#ref-edit-bar`` |
| Opportunity, Assessment | derived from `oppAssessDraft` via `oppAssessDirtyKeys()` (``oppAssessDirtyKeys()``) | `#opp-assess-savebar` | appended to `#opp-assessment-mount`, ``mountOppAssessmentLenses()`` |

**Accounts reuses `.ref-edit-bar`** as a class, at ``frontend/index.html`'s Accounts bar`.

**The Reference bar reports openness as well as dirtiness**, "N fields open, M changed", and shows Save only when `dirtyCount` is above zero while Cancel shows whenever a field is open.

**The assessment registry is DERIVED, not declared.** There is no `oppEdits`. Round 28 Phase 5 recorded the reason: a parallel map would be a second source of truth that agrees today, and because the set is derived it inherits the clearing that Round 28 Phase 1 added on a record change with no extra code.

**The assessment save is a batch and reports partial failure by name.** `saveAllOppAssess()` at `frontend/app.js`, `saveAllOppAssess` loops the whole dirty set, keeps a criterion dirty with its typed reason if its write is refused, and reports "Recorded X of N. Not recorded: ..." rather than success. A missing required reason refuses the whole batch before anything is written, which is a different thing from a partial failure.

---

## 10. Opportunity's stage progression lives inside the stage panel

**Built Round 21.** `loadOppStageTab()` at `frontend/app.js`, `loadOppStageTab()` clears the transition slot entirely when the open tab is not the record's stage:

```js
if (stageName !== currentStage) { tEl.innerHTML = ''; return }
```

(`frontend/app.js`, the `stageName !== currentStage` guard.) Otherwise `renderOppAdvanceControl()` at `:683` renders it.

**So Opportunity and Test Bed enforce the same business rule by opposite means**: Test Bed places the control on the record-level tab line and DISABLES it off the current stage tab; Opportunity places it inside the stage panel, where it does not exist off the current stage tab. The rule, progression happens from inside the stage, is identical. Only the mechanism differs.

**Mark Closed Lost sits beside the advance control** as a `btn-ghost` against the advance's `btn-primary`, opening a prompt via `openCloseLostPrompt()` at `frontend/app.js`, `openCloseLostPrompt`.

> The rationale, from the comment: there is one primary action on this panel. The prompt wires `returnFocusTo` back to the button that opened it, which is Section 4's pattern applied without Section 4 mentioning it.

**Test Bed has no equivalent.** `close-lost`, `closeLost`, `abandon` and `Closed Lost` all return zero in `frontend/test-bed-detail.js`. There is no precedent to copy from.

---

## The three-way classification

**The split this document has never had.** Sections 1 to 5 were written as intent and read as though they were all unbuilt; Sections 6 to 10 are built and were written nowhere.

| | Sections | Note |
|---|---|---|
| **Specified and built** | 3, 4, and the discard-confirm halves of 5 | Section 4's focus-trap tokens appear on 42 lines of `frontend/*.js` and Section 3's `.msg-error` on 35. Both counts are LINES, not sites: the same line can carry two references, and 42 lines hold 53 occurrences. Sections 1 and 2 are PARTIAL: 27 `tabindex` attributes and 8 `Enter` handlers exist, which is neither nothing nor the standard |
| **Specified and not built** | 5's system-wide dirty-state registry | The only genuinely unbuilt claim in the document. Round 28 Phase 7 built a scoped guard against it and recorded a deliberate departure: it warns only where work is actually lost, because Opportunity clears drafts on a record change rather than on leaving a page |
| **Built and not specified** | 6, 7, 8, 9, 10 | Everything in Part two, plus the sample below |

**Sized rather than enumerated.** Ten built mechanisms carrying a written rationale were sampled in Round 29 Phase 0 and checked against this document. **Ten had zero coverage.** Beyond Sections 6 to 10, the sample also named: the load-token race discipline (32 references in `frontend/`), the sub-tab strip component (`createSubTabs`, 10), the definitions disclosure control (`.anchors-toggle`, 10), the pending-versus-confirmed tick mark (`.tb-crit-box--pending`), and the mandatory reason on a revision.

**Those are not documented here yet.** Naming them is not recording them, and a list that pretends otherwise would be the same failure one level down.

## 11. The assessment hover: one popup per row, two contents

Built in Round 31 Phase 3 and generalised in Round 32 Phases 1 and 2. Recorded
here because this document's own audit found ten built mechanisms with zero
coverage, and naming them was not recording them.

**One `.opp-assess-defn` element per criterion row, carrying two different
strings for two different targets.** Hovering the criterion NAME shows the
criterion's question; hovering a level SEGMENT shows that level's definition.
Sharing one element makes them mutually exclusive by construction rather than
by a rule somebody has to maintain: two elements could both be open, which is a
state nobody designed.

**The affordance is the mechanism, not the popup.** A `title` attribute carried
the question from Round 30 Phase 2 and was never removed, and the business
still reported the text missing. Measured, the name had `cursor: auto`, no
underline and `tabIndex: -1`: nothing on the row said it was hoverable. The
repair is a dotted underline and `cursor: help`. **Dotted rather than solid**,
because a solid underline in this stylesheet means a thing you click
(`.doc-link`, `.anchors-toggle`, both with `cursor: pointer`).

**A native `title` is removed when a popup replaces it**, or both fire about a
second apart, and `aria-describedby` against a visually hidden span keeps the
question available to screen readers without adding a tab stop.

| Property | Rule | Why |
|---|---|---|
| Placement | Floating, never in-row | In-row moves every row below down 36px under the pointer |
| Anchor | To the element explained, not to the row | At 1240 the row wraps and `top: 100%` lands below the reason cell |
| Alignment | Left on a name, centred-and-clamped on a segment | A name is the row's leftmost element; centring starts it 38px outside the pane |
| Show delay | 140ms | A pointer crossing the name column opens seven distinct boxes in 681ms |
| Hide | Immediate, and cancels a pending show | A tooltip that lingers is a tooltip in the way |
| Identity | Read from the element at hover time | The panel re-renders on every draft change |
| Focus | Segments yes, names no | Segments are radio inputs already; seven spans would be seven new tab stops |
| Elevation | The shared floating-surface shadow | Four other popups carry it; without it an overlapped line reads as sliced |

**Each property is re-derived rather than copied when the mechanism reaches a
new target.** Round 32 Phase 1 re-derived all five for a criterion name and
**three inverted**: centring, focus and the show delay. A copy would have been
wrong three ways.

## Cross-reference

This document is the target DESIGN_PRINCIPLES.md's Deferred scope entry for "Tab/Enter field navigation and unsaved-changes-on-navigate warnings" points to. Build against this specification when that work is picked up.

**CORRECTED 2026-09-13. The superseded sentence is left visible because it is the same failure this document's own status line was corrected for in Round 29.** It read: *"This document is not itself built from, it describes intended behavior only."*

**That was false when it was written and is more false now.** Part two exists precisely to record what IS built, with a file and a line per statement. Section 12 below is BUILT AND ENFORCED: the shell components exist, and a gate stage fails a commit that routes around them. **A document that tells its reader it is only aspirational invites them to skip the parts that are load-bearing** - which is what the Round 29 correction says, one sentence earlier in the same document, about a different line.


## 12. The panel shell, the modal shape, and the gate that holds them

**Built 2026-09-13, on the Leads card. Read from source.**

**This is Section 0's panel-scope expression, and the first section of this
document that a commit can FAIL.**

### The shell

`Panel` and `PanelHeader` at `frontend-react/src/ui/Panel.tsx`, `SaveControl`
at `frontend-react/src/ui/SaveControl.tsx`.

**A `Panel` renders its own header and takes actions ONLY through the
header's slot.** There is no prop for a footer and no slot below the body, so
a panel cannot place its Save below its field: it has nowhere to put it.

> The rationale, from the file: the panels were not inconsistent through
> carelessness. **There was never one thing to build them from.**

**The header's order is title, secondary label, actions**, and the actions are
pinned right by `margin-left: auto` on `.panel-actions` - the same mechanism
Section 6 records for the record action bar, which is what makes them one
principle rather than two rules that agree.

**`.panel-head` has a FIXED height, not a minimum.** A minimum grows to its
tallest child, so a header holding buttons ends up taller than one holding
only a title and the fields below them stop lining up. Measured at 9px of
drift the day before this was built, caused by exactly that.

**`SaveControl` is one definition of what dirty means to a control**: Save
disabled until dirty, Discard rendered only when there is something to
revert, Discard before Save in the DOM so the reversible action comes first
in the tab order. **Four panels implemented "the same" four different ways
and half of them had no Discard at all.**

**One treatment across panels, `.btn-sm`. The record bar keeps `btn-primary`
against `btn-ghost`**, because Section 10 records that distinction as
deliberate - "there is one primary action on this panel" - and flattening it
would supersede a ruling without anybody deciding to.

### The modal shape

`Modal` and `ModalClose` at `frontend-react/src/ui/Modal.tsx`.

**A modal is a DISTINCT shape: its actions sit in a FOOTER row, not on a
header line.** The established dialogue convention, GOV.UK and APG, both of
which this document already cites. **Named explicitly so a modal is a
convention rather than a silent exception to Section 12's header rule.**

**Sections 4 and 5 live INSIDE it**: focus to the first focusable element on
open and back to the opener on close; Tab and Shift+Tab wrapping within;
Escape closing by the same path as the dismiss control; the backdrop refusal
WITH its nudge; and confirm-and-discard through the shell's shared dialogue,
with this document's own inert-guard so one Escape cannot fire two handlers.

**The footer is a RENDER FUNCTION taking `requestClose`.** That is not a
style: it makes the dismiss control and the Escape key the same function.

> **Two paths out of one dialogue is how the lead card ended up with Escape
> doing nothing while Close discarded silently.**

**Measured before it was built, 2026-09-13**: the lead card's two dialogues
implemented **none** of Section 4 and one third of Section 5. **Section 4
survived the migration** - Park moved intact into `ParkForm.tsx` - **and was
never applied to the surfaces built after it.** That distinction matters:
this was not rot, it was drift, and a document cannot stop drift on its own.

### The gate

`scripts/tests/panel-conformance.test.mjs`, in the pure suite, seven checks:
every control on a Leads surface carries a class the stylesheet defines;
panel actions use one treatment; every `aria-controls` names a declared id;
no Leads surface builds a shell or a modal backdrop of its own; and the
registry is structural.

**The population comes from `data-panel`, which the shell emits.** A panel
joins the census by existing, so a list nobody updated cannot silently omit
one.

**The one exemption is a FUNCTION CALL in the guard's own module**,
`frozenByRuling`, naming `FollowUpTask` - frozen by ruling until the
follow-up entity round rebuilds it. **A comment could not have granted it**,
which is deliberate: minting an exemption is an edit somebody reads.

`scripts/tests/standards-staleness.test.mjs` fails when THIS DOCUMENT cites a
name the code no longer has. **It found one on its first run**: the prototype
was cited under a filename that resolves to nothing, in the paragraph
explaining why this document is trustworthy.

## Identifiers asserted ABSENT

**The document's own escape hatch, and it is machine-read.**
`scripts/tests/standards-staleness.test.mjs` fails the suite when this
document cites a name that no longer exists in `frontend/`,
`frontend-react/src/` or `src/`. Some names are cited precisely BECAUSE they
do not exist, and this is where they are declared, so "there is no such
thing" stays sayable without the check going red for being right.

- `oppEdits` - Section 9. The assessment registry is DERIVED; a parallel map
  would be a second source of truth that agrees today.
- `closeLost` - Section 10. Test Bed has no Closed Lost equivalent, and there
  is no precedent to copy from.
- `abandon` - Section 10, the same search.
- `new-lead-modal` - Section 5. The container id BEFORE the batch grid
  replaced the form; it is now `new-contact-form`.
- `requestCloseCdParkForm` - Section 5's historical note. One of
  `contact-detail.js`'s two close paths, kept as a record of an asymmetry
  that no longer exists because `ParkForm.tsx` has one close path.

**Adding a name here is an edit somebody reads in a diff.** It is not a way
to silence the check: a stale citation and a deliberate absence look
identical to a scan, and the difference is a claim somebody has to make out
loud.
