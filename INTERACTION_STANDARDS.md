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

**Concrete example, current state, to be preserved:** the New Lead form (`frontend/index.html` lines 67-152) lays out via `.form-grid`, a plain two-column CSS grid with no `order` overrides, so DOM order and visual order already match: Name → Company → Industry → Email → Mobile → Country → Region → Source → Save contact. This document's requirement is to keep that property true as the app grows, not to change today's order.

## 2. Enter submits the form, except in a `<textarea>`

Pressing Enter inside any single-line field (`<input type="text">`, `email`, `date`, `<select>`) submits the form, the same action as clicking its primary submit button (`btn-save-contact`, `cd-park-save`, and equivalents added later).

Pressing Enter inside a `<textarea>` (e.g. `cd-park-reason`) inserts a newline and does not submit, matching native multi-line-field behavior. This is a widget-specific distinction, not a blanket global Enter-submits-everything binding, consistent with APG's keyboard-interface guidance that a key's effect depends on the widget that has focus.

## 3. Errors: a summary at the top, plus inline per field, never a modal or toast

On a failed submission:

1. An error summary appears at the top of the current form or panel (not the page, these are inline forms and panels, not separate pages), titled to state a problem exists, listing every failing field as a link.
2. Each linked item, when activated, moves focus to its corresponding field.
3. Each field also gets its own inline error text directly beneath it. Both together, summary and inline, GOV.UK's actual pattern is both at once, not either/or.
4. On submission failure, focus moves programmatically to the error summary itself (a `tabindex="-1"` container, `.focus()` called on it), not to the first invalid field, so the full list of problems is available before the user lands on any one of them.
5. This is the only error-display pattern for form validation anywhere in the app. It replaces any modal, toast, or `alert()`-style validation error, wherever one exists today or gets added later.

## 4. Focus trapping in in-page dialogs, e.g. Park

Park (`frontend/index.html` lines 235-247) is an inline panel, not a full-screen overlay, but it functions as a dialog: opening it interrupts the row it belongs to and demands a decision before anything else on that row makes sense. Applying APG's Dialog (Modal) pattern:

- On open, focus moves to the panel's first focusable field (`cd-park-date`).
- Tab and Shift+Tab cycle only through the panel's own focusable elements, date → reason → Cancel → Save & park → back to date, not out into the rest of the page behind it.
- Escape closes the panel (same effect as Cancel) and returns focus to the control that opened it (the row's Park button).
- This applies to any future in-page panel that plays the same role as Park, an inline decision point that should behave like a dialog, not just to Park specifically.

## 5. Unsaved-changes warning: real navigation only, never the app's own post-save redirect

The dirty-state registry (DESIGN_PRINCIPLES.md, Deferred scope) warns on genuine navigation away from unsaved changes: a nav-bar link click, browser back/forward, or closing/reloading the tab (`beforeunload`).

It must **not** warn on the app's own post-save redirect, for example a successful Park save calling `loadContactDetail()`, or a successful create calling `navigate('leads')`. Concretely, this means the dirty flag must be cleared explicitly at the moment a save call succeeds, before whatever `navigate()` call the app itself makes next runs, rather than trying to infer after the fact whether a given navigation was user-initiated. By the time a post-save `navigate()` fires, there is no reliable signal left to distinguish it from a real user click unless the flag was already cleared first.

---

## Cross-reference

This document is the target DESIGN_PRINCIPLES.md's Deferred scope entry for "Tab/Enter field navigation and unsaved-changes-on-navigate warnings" points to. Build against this specification when that work is picked up. This document is not itself built from, it describes intended behavior only.
