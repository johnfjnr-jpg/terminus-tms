# Terminus Management System: Interaction Standards

**Status:** Specification only, not yet implemented. This is the concrete spec that DESIGN_PRINCIPLES.md's Deferred scope entry for "Tab/Enter field navigation and unsaved-changes-on-navigate warnings" points to, written now so that work has a real target to build against when it's picked up, same discipline as extracting the prototype before building (DESIGN_PRINCIPLES.md Section 3, rule 8): write down what "correct" concretely means before writing any code against it, not after.

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

---

## Cross-reference

This document is the target DESIGN_PRINCIPLES.md's Deferred scope entry for "Tab/Enter field navigation and unsaved-changes-on-navigate warnings" points to. Build against this specification when that work is picked up. This document is not itself built from, it describes intended behavior only.
