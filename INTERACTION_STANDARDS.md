# Terminus Management System: Interaction Standards

**Status:** MIXED, and it is now recorded per section rather than per document. See the classification table below.

**Corrected Round 29 Phase 1, 2026-08-24.** This line previously read "Specification only, not yet implemented", and that was false by the time anyone read it: Section 4's focus trapping is referenced on 42 lines of `frontend/*.js`, Section 3's `.msg-error` treatment on 35, and Section 5's own body names three working implementations. Only Section 5's system-wide dirty-state registry is genuinely unbuilt. A status line that says "none of this exists" about a document describing things that do exist is worse than no status line, because it invites a reader to skip the parts that are load-bearing.

**This document also now records what is BUILT and was never specified**, which it had no home for before. Round 29 exists because three times the business has been asked to screenshot Test Bed so a pattern could be learned. A convention that lives only in the product and in one person's memory is re-derived, and Round 28 recorded nine instances of a fix built for the screen that existed at the time, every one of them a pattern nobody had written down. This is the concrete spec that DESIGN_PRINCIPLES.md's Deferred scope entry for "Tab/Enter field navigation and unsaved-changes-on-navigate warnings" points to, written now so that work has a real target to build against when it's picked up, same discipline as extracting the prototype before building (DESIGN_PRINCIPLES.md Section 3, rule 8): write down what "correct" concretely means before writing any code against it, not after.

**Why this is its own document, not folded into DESIGN_PRINCIPLES.md or a prototype-extraction spec:** DESIGN_PRINCIPLES.md records confirmed product and data-model decisions. A prototype-extraction spec records what `Terminus_Ops_dc.html` actually does, cited by section and line. Neither fits here: this isn't a product decision, and the prototype has no real forms or Tab/Enter handling to extract from at all, confirmed directly against its source. This is general professional interaction-design practice, external to this project, sourced from two published standards below, and applied concretely to this app's real screens and field IDs, not just linked to.

---

## Sources

- **GOV.UK Design System** (https://design-system.service.gov.uk), reference implementation **govuk-frontend** (https://github.com/alphagov/govuk-frontend). Used here for the **error summary pattern**: https://design-system.service.gov.uk/components/error-summary/. On a failed form submission, an error summary listing every validation failure appears above the form; each item is a link to its corresponding field; focus moves to the summary itself on submission failure, not to the first invalid field, so a screen-reader user hears the full list of what's wrong before landing on any one field.
- **WAI-ARIA Authoring Practices Guide (APG)** (https://www.w3.org/WAI/ARIA/apg/). Used here for general keyboard interaction conventions (https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) and the Dialog (Modal) pattern's focus-management requirements (https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), applied to Park and any future in-page panel that plays the same role even though it isn't a full-screen overlay.

---

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

New Lead's implementation lives in `frontend/app.js` (`newLeadDirty`, `openNewLeadModal`/`closeNewLeadModal`/`requestCloseNewLeadModal`), Park's in `frontend/contact-detail.js` (`cdParkDirty`, `openCdParkForm`/`closeCdParkForm`/`requestCloseCdParkForm`, retrofitted from New Lead's, not a second pattern). Neither is the system-wide dirty-state registry this section specifies, and neither has any connection to real page navigation at all - they're a working proof that the underlying idea, don't silently discard real unsaved input, holds up in two small, real cases (now with two distinct, correctly-matched mechanisms within them), for whenever the full system-wide version gets built.

**A third working example, Round 3, 2026-08-16: Opportunity's Est. Close Date reason dialogue.** Built initially with only backdrop-click and Escape as cancel paths, missing Park's full Tab-cycling focus trap. Corrected to match Section 4 precisely once the gap was raised, not accepted as a smaller, dialogue-specific standard, a single Escape-key listener attached only while the dialogue is open and removed on close (the first version had two overlapping Escape owners, a real bug in its own right, fixed as part of bringing this in line), Tab/Shift+Tab confined to exactly the dialogue's own three elements, focus landing on the reason field on open and returning to the control that opened it on close. Also verified, empirically, not just reasoned about, that cancelling this dialogue does not discard an unrelated dirty field edited in the same batched save, dirtying two fields (Est. Close Date and an unrelated field), cancelling the dialogue, and confirming both survived, then genuinely re-saving both to confirm the surviving state wasn't inert leftover DOM rather than something a real save would actually persist.

**A third case, distinct from the two above, confirmed 2026-08-15.** The binary in this section, accidental dismissal versus intentional leave, was written for one dialog's own dismissal. It doesn't fully cover a related but different situation, found when 4 more sites in `contact-detail.js` needed the same underlying protection: `linkCdAccount`, `attemptContactUnqualifyFromDetail`, `onCdAddNoteClick`, `saveCdParkForm`. None of these are a dialog being dismissed at all, they're deliberate clicks on unrelated controls (Link an Account, Move to Unqualified, Add a note, Save & park) that happen to trigger a side-effect reload (`loadContactDetail()`) which would silently clobber a *separate*, unrelated field left open elsewhere on the same page. **Confirm-and-discard is still the right mechanism for this third case, but the reasoning is different, not equivalent to Cancel/Escape's case:** refusing the action outright, the way a backdrop-click gets refused, would block a valid, unrelated action for a reason the user can't see, there's no coherent "Save" button to highlight, since the dirty field isn't part of what the user is actually interacting with. That makes outright refusal worse here than in Park's own dismissal case, not just unnecessary. **Naming this as its own case:** an unrelated deliberate action threatens someone else's unsaved edit elsewhere on the page. Same mechanism as intentional-leave (confirm-and-discard), different reason for choosing it. When the system-wide dirty-state registry gets built, it needs to handle this third case explicitly, not just the original two.

**A real asymmetry within Park's own implementation, confirmed 2026-08-15, not a bug, worth knowing before either path is touched again.** Park now has two different sub-mechanisms protecting against the same underlying risk, a keydown handler double-firing. `requestCloseCdParkForm` (Cancel/X/Escape, Park stays open while the confirm dialog is shown) relies on the inert-guard, `discardConfirmIsOpen()` checked at the top of Park's own keydown handler. `saveCdParkForm`'s new dirty-check branch (added for the 4-site fix above) instead calls `closeCdParkForm()` first, which removes Park's keydown listener entirely, before `openDiscardConfirm()` ever runs, so there's no window where both handlers are attached simultaneously, prevented by removal rather than by the inert-check. Both are correct on inspection, confirmed by real test evidence for both paths, but they are genuinely two different sub-mechanisms in one file, not one guard reused twice. A future edit to one path (e.g. adding a third way to close Park) needs to account for both, not assume fixing `requestCloseCdParkForm` alone covers `saveCdParkForm` too.

---

## Part two: what is BUILT

**Added Round 29 Phase 1, 2026-08-24. Read from source, not described from screenshots.**

Sections 1 to 5 above describe intended behaviour. Everything below describes behaviour that exists, with a file and line for every statement, so a reader can check it rather than trust it. **Where the code carries a written rationale, the rationale is carried here too**: the reasoning is why these conventions survived, and it is the part that would otherwise be re-derived, usually wrongly.

---

## 6. The record action bar sits at the right end of the tab strip, inside it

**Test Bed, built Round 7 Phase 6.**

`.tb-tab-actions` is the last child of the tab strip element, after the ten stage tabs, at `frontend/index.html:873`. It holds three buttons in this order: `#tb-cancel-all` (`:874`), `#tb-save-all` (`:875`), `#tb-next-stage-btn` (`:876`).

**It is INSIDE the strip, not beside it.** `margin-left: auto` keeps it pinned right regardless of how many stage tabs precede it, and it participates in the strip's `flex-wrap`.

**It replaced two things, not one:** a separate save-bar banner line and a "Stage Transition" section. That is why there is no banner anywhere on Test Bed and no transition section in the stage panel.

**Two feedback elements, deliberately not merged**, `#tb-save-feedback` (`:887`) and `#tb-next-stage-feedback` (`:888`), both directly under the tab row so either is readable without scrolling.

> The rationale, from the markup comment: one reports "your edit was refused", the other "this transition is blocked", and merging them would let the second overwrite the first.

`tb-save-feedback` was moved here rather than deleted with the banner, because `clearTbSaveFeedback()` and `saveTbFields()` both read it with no null guard and removing the element would have thrown on every save.

**Cancel and Save changes appear only when there is something to save.** `updateTbSaveBar()` at `frontend/test-bed-detail.js:2589`:

```js
const dirtyCount = Object.values(tbEdits).filter(e => e.draft !== e.orig).length
const show = dirtyCount > 0 || tbInvalidFields.size > 0
```

**Two rules that are not obvious from the screen:**

- **An invalid field disables Save outright** rather than letting the value travel to the server to be refused (`saveBtn.disabled = tbInvalidFields.size > 0`).
- **The bar stays visible at dirtyCount 0 while a field is invalid.** The rationale, from the comment: `tb-save-feedback` sits alongside the controls, so hiding them would hide the message explaining the block.

`#tb-save-all` is wired once to `saveTbFields` in `wireTbOnce()` at `frontend/test-bed-detail.js:2728`, and drafts live in `tbEdits`, declared at `:15`, which is the same map every other Test Bed field uses.

---

## 7. Next Stage is disabled by two conditions, and neither is what you would guess

**`refreshTbNextStageButton()` at `frontend/app.js:4240` is the ONLY writer of `#tb-next-stage-btn.disabled`.** There are no other writers anywhere in `frontend/`.

| # | Condition | What the button shows |
|---|---|---|
| 1 | `!nextStage`, the record is at its final stage | label changes to **"Final stage"**, disabled |
| 2 | `!onCurrentStageTab`, the open tab is not `stage-<record.status>` | label stays **"Next Stage"**, disabled |

**Unsaved changes do NOT disable it.** **Unmet exit criteria do NOT disable it.** Recorded explicitly because both are the natural guess and both are wrong: Round 29 Phase 0 was asked to settle this after a rule was stated from one screenshot and corrected from a second, and both readings were wrong. The function references neither `tbEdits` nor any criteria state.

**Unmet criteria are refused at the SERVER and explained in place.** `attemptTransition` at `frontend/app.js:2593` posts the transition, and on a 422 with `blocking[]` renders that list into the feedback element it was given. So the button is clickable, the attempt is made, and the refusal names what is outstanding.

> The rationale for condition 2, from the comment above the function: **stage progression happens from inside the stage itself.** The user opens the record's real current stage tab, reviews its criteria and approvals, and progresses from there. This is called a confirmed business rule.

**The two disabled reasons must not collapse into one greyed button.** "Final stage" is terminal and nothing the user does will change it; "not the current stage" is a one-click fix. The distinction is carried by the LABEL, not by a hint: Round 8 Phase 4 removed the explanatory hint ("Open the <stage> tab to progress") and recorded that as a deliberate reversal of half of Round 7 Phase 6, keeping the label difference and losing the one-line explanation of why.

**State is cached in `tbNextStageState`** (`:4217`) and refreshed by `wireTbNextStageButton()` (`:4219`), because the button's enabled-ness depends on the OPEN TAB, which changes without a re-render.

---

## 8. The chevron hover shows a stage's outstanding requirements, for any stage

**Test Bed, built Round 7 Phase 9, `wireTbChevronHover()` at `frontend/app.js:1495`.**

Hovering a chevron shows a popup listing that stage's outstanding exit criteria, from `GET /api/records/:id/exit-criteria?stage=<name>`, or "Nothing outstanding."

**It answers for stages the record has not reached, by construction rather than by a special case.** The endpoint's `?stage=` is an override for which stage to compute FROM, and it "never validates whether a reachable stage was requested, only which `stage_gate_rules` rows get looked up" (`src/routes/records.js:301` and the comment above it).

**Four properties that look incidental and are not.** Each was built deliberately and each would be re-derived wrongly:

| Property | Where | Why |
|---|---|---|
| **180ms debounce** before fetching | `TB_CHEVRON_HOVER_DELAY_MS`, `frontend/app.js:1445` | A pointer sweeps eight chevrons in well under a second. Firing on every `mouseover` would issue eight requests for one gesture, so the fetch starts only once the pointer has rested |
| **A load token** | `tbChevronLoadToken`, used in `hideTbChevronPopup()` at `:1447` and in the handler | Hovering is faster and less deliberate than clicking, so responses arrive out of order. A stale one must never paint. The symptom would be the wrong stage's criteria appearing for a moment and vanishing, invisible to any test that hovers once and waits |
| **`mouseleave` on the WRAPPER**, not the chevron | `:1495` onward | So moving the pointer from a chevron INTO the popup is not a leave |
| **No click handler on the chevron, ever** | same | Confirmed by history in Round 5 Phases 7 and 8: the chevron has never had one, and adding hover must not add click |

**Popup positioning is centred then clamped** inside the wrapper (`positionTbChevronPopup()`, `:1460`), because the strip runs the full page width and a centred popup on the leftmost or rightmost chevron would be clipped at the viewport edge.

**The record identity is read at hover time from the element, not closed over.** Round 18 Phase 1 fixed two faults with one cause here: `#tb-chevron-wrap` is static markup in `frontend/index.html:797`, so its `dataset.wired` survives every navigation, and the popup's cache key was stage name alone. Either alone gives a wrong answer on the second record opened in a page session. **It survived four rounds because it is correct for the first record opened, and every test opens one record.**

---

## 9. Dirty state and save bars: three mechanisms on Opportunity, one on Test Bed

**Recorded as fact, not as a recommendation.** This is the divergence Round 29 exists to converge, and the count is the starting point.

| Record type | Mechanism | Bar | Where the bar sits |
|---|---|---|---|
| Test Bed | `tbEdits` (`test-bed-detail.js:15`) | `.tb-tab-actions` | inside the tab strip, `index.html:873` |
| Opportunity, Reference | `refEdits`, via `updateRefEditBar()` (`opportunity-reference.js:387`) | `#ref-edit-bar` | inside the Reference panel, `index.html:1493` |
| Opportunity, Assessment | derived from `oppAssessDraft` via `oppAssessDirtyKeys()` (`app.js:1975`) | `#opp-assess-savebar` | appended to `#opp-assessment-mount`, `app.js:2177` |

**Accounts reuses `.ref-edit-bar`** as a class, at `index.html:403`.

**The Reference bar reports openness as well as dirtiness**, "N fields open, M changed", and shows Save only when `dirtyCount` is above zero while Cancel shows whenever a field is open.

**The assessment registry is DERIVED, not declared.** There is no `oppEdits`. Round 28 Phase 5 recorded the reason: a parallel map would be a second source of truth that agrees today, and because the set is derived it inherits the clearing that Round 28 Phase 1 added on a record change with no extra code.

**The assessment save is a batch and reports partial failure by name.** `saveAllOppAssess()` at `frontend/app.js:2044` loops the whole dirty set, keeps a criterion dirty with its typed reason if its write is refused, and reports "Recorded X of N. Not recorded: ..." rather than success. A missing required reason refuses the whole batch before anything is written, which is a different thing from a partial failure.

---

## 10. Opportunity's stage progression lives inside the stage panel

**Built Round 21.** `loadOppStageTab()` at `frontend/app.js:595` clears the transition slot entirely when the open tab is not the record's stage:

```js
if (stageName !== currentStage) { tEl.innerHTML = ''; return }
```

(`frontend/app.js:618`.) Otherwise `renderOppAdvanceControl()` at `:683` renders it.

**So Opportunity and Test Bed enforce the same business rule by opposite means**: Test Bed places the control on the record-level tab line and DISABLES it off the current stage tab; Opportunity places it inside the stage panel, where it does not exist off the current stage tab. The rule, progression happens from inside the stage, is identical. Only the mechanism differs.

**Mark Closed Lost sits beside the advance control** as a `btn-ghost` against the advance's `btn-primary`, opening a prompt via `openCloseLostPrompt()` at `frontend/app.js:727`.

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

## Cross-reference

This document is the target DESIGN_PRINCIPLES.md's Deferred scope entry for "Tab/Enter field navigation and unsaved-changes-on-navigate warnings" points to. Build against this specification when that work is picked up. This document is not itself built from, it describes intended behavior only.
