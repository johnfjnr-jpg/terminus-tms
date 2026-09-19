// ── THE SHARED ANCHOR POPUP ──────────────────────────────────────────────
//
// R2, ruled OPTION B by John 2026-09-19: the Test Bed's scoring card shows its
// anchor wording through THIS, rather than growing a reserved in-row region of
// its own. Verification 23's remedy is deletion rather than reconciliation -
// one surface becomes a CALLER of the other - and this module is where the one
// mechanism now lives.
//
// WHY B AND NOT A, measured at the scoring round's Phase 0: a region sized for
// the longest anchor (302 characters) costs 120px per row at 1240, against a
// row head of 77px - roughly 600px across five criteria, empty until hovered.
// The Opportunity had already measured the in-row cost at 36px and chosen to
// float; this is the same decision, made once.
//
// WHAT IS GENERIC AND WHAT IS NOT. The caller owns its own markup, its own
// wording lookup and its own box element. This module owns the four things that
// must be identical on both surfaces:
//
//   1. CENTRED THEN CLAMPED positioning, section 8's rule. Measured at 1240 a
//      left-aligned box on the rightmost segment overhangs the pane by 62px.
//   2. AT MOST ONE renders anywhere (R6).
//   3. DISMISS ON SELECTION, surviving the re-render that a selection causes
//      (R6).
//   4. The focus fallback: a FOCUSED anchor outlives a HOVERED one, so a
//      pointer crossing a group while somebody is arrow-keying through it does
//      not take their wording away and fail to give it back.
//
// It is plain script rather than a module because app.js is a classic script
// and loads it as a global; the React side reaches it through the shell seam
// (shell-services.ts) rather than touching `window` directly, so the coupling
// is declared in one place.
(function () {
  'use strict'

  // Every box this module manages wears this class, whatever surface rendered
  // it. The sweep is by CLASS rather than by a list of ids, so a new caller
  // joins by wearing it and cannot be forgotten (Verification 19: enumerate by
  // a declared property, never by name).
  var BOX_CLASS = 'anchor-defn'

  // R6: which key, if any, a SELECTION has just dismissed. Selecting restores
  // focus to the control, and a focused control is exactly what the fallback
  // re-shows - so without this the popup a person dismissed by choosing comes
  // straight back and parks there.
  var dismissedFor = null

  function boxes() {
    return Array.prototype.slice.call(document.querySelectorAll('.' + BOX_CLASS))
  }

  function conceal(box) {
    box.classList.add('hidden')
    box.setAttribute('aria-hidden', 'true')
  }

  /**
   * Show `wording` in `box`, positioned under `anchorEl` and clamped to the
   * group `anchorEl` sits in.
   *
   * `key` identifies the row for the dismissal, and `groupSelector` names the
   * element the box is clamped to - the row is the width the panel actually
   * has, which is why it is not the viewport.
   */
  function show(opts) {
    var anchorEl = opts.anchor
    var box = opts.box
    if (!anchorEl || !box) return
    var key = opts.key

    // R6, and the half that is easy to miss: a selection RE-RENDERS the row, so
    // the control under a STATIONARY pointer is destroyed and recreated and the
    // browser fires a fresh mouseover on the new node. That is not the person
    // re-entering anything, and it must not undo the dismissal.
    if (key !== undefined && key !== null && dismissedFor === key) return

    box.innerHTML = ''
    if (opts.label !== undefined && opts.label !== null && opts.label !== '') {
      var l = document.createElement('span')
      l.className = 'anchor-defn-l'
      l.textContent = String(opts.label)
      box.appendChild(l)
    }
    box.appendChild(document.createTextNode(String(opts.wording == null ? '' : opts.wording)))

    // R6: AT MOST ONE. Hiding the others happens in the SHOW path, never in the
    // hide path - in the hide path it would suppress the one popup the focus
    // fallback exists to protect, which is what Round 34 correctly declined.
    var all = boxes()
    for (var i = 0; i < all.length; i++) if (all[i] !== box) conceal(all[i])

    box.classList.remove('hidden')
    box.setAttribute('aria-hidden', 'false')

    // CENTRED THEN CLAMPED. The box is positioned against its offset parent,
    // and clamped so it cannot overhang the group it explains.
    var row = box.parentElement
    if (!row) return
    var rr = row.getBoundingClientRect()
    var er = anchorEl.getBoundingClientRect()
    var bw = box.getBoundingClientRect().width
    var centred = (er.left - rr.left) + (er.width / 2) - (bw / 2)
    box.style.left = Math.max(0, Math.min(centred, rr.width - bw)) + 'px'

    // `top` is set here rather than left to the stylesheet, because the element
    // can be shared with other content whose inline `top` would otherwise leak
    // into the next thing shown in it.
    var group = opts.groupSelector ? anchorEl.closest(opts.groupSelector) : anchorEl.parentElement
    var gr = (group || anchorEl).getBoundingClientRect()
    box.style.top = (gr.bottom - rr.top) + 'px'
  }

  /**
   * Hide every box, with the focus fallback.
   *
   * `focusedWithin(box)` is the caller's answer to "is one of my controls in
   * this row still focused", because only the caller knows what its controls
   * are. Returning an element re-shows that row rather than hiding it.
   */
  function hide(opts) {
    var focusedWithin = opts && opts.focusedWithin
    var reshow = opts && opts.reshow
    var all = boxes()
    for (var i = 0; i < all.length; i++) {
      var box = all[i]
      var focused = focusedWithin ? focusedWithin(box) : null
      // R6: a control the person has just SELECTED is focused, and that focus
      // must not resurrect the popup the selection dismissed.
      var fkey = focused && focused.dataset ? focused.dataset.criterion : undefined
      if (focused && reshow && fkey !== dismissedFor) { reshow(focused); continue }
      conceal(box)
    }
    // The pointer or the focus has genuinely left, so a standing dismissal is
    // spent. LAST, after the fallback above has had its chance to read it.
    dismissedFor = null
  }

  /** R6: selecting commits and clears the popup. Called AFTER any re-render. */
  function dismiss(key) {
    dismissedFor = key
    var all = boxes()
    for (var i = 0; i < all.length; i++) conceal(all[i])
  }

  window.TerminusAnchor = { show: show, hide: hide, dismiss: dismiss, BOX_CLASS: BOX_CLASS }
})()
