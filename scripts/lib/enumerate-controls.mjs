// THE ONE ENUMERATION OF WHAT COUNTS AS A CONTROL.
//
// ── WHY THIS IS A MODULE ──────────────────────────────────────────────────
//
// probe-readonly-view enumerated from an ALLOWLIST: `input, textarea, select`
// plus four class names. The parked round's own finding was that the ring-radio
// "appears in no door selector", and an allowlist cannot report what it does
// not name. Measured in P2.1: with the input-shaped findings fixed, the probe
// reported `296 controls / 0 typeable, PASS` while the census found 28 controls
// still reachable, none of them an input. The probe was blind to exactly the
// class the door had left open.
//
// Two instruments also disagreed about CLASSIFICATION rather than about the
// product - the census counted a sub-tab panel as a write control while the
// door's own rule correctly excluded it. One definition, imported by both, is
// the fix for that: Verification 20, read through the accessor the
// authoritative consumer uses.
//
// ── IT RUNS IN THE PAGE ───────────────────────────────────────────────────
//
// Passed to page.evaluate, so it must be SELF-CONTAINED: no imports, no
// closure variables, everything it needs declared inside.

/**
 * Enumerate every control inside a view, by what things ARE.
 *
 *   L  a direct activating listener, seen at registration by the instrument
 *      installed with evaluateOnNewDocument
 *   N  a natively interactive tag
 *   R  an ARIA widget role, or membership of the tab order
 *   A  an inline on* attribute
 *   D  carried the door's own `data-door-ti` marker, so a NEUTRALISED control
 *      stays in the population instead of vanishing from it
 *
 * @param {string} viewId
 * @returns {Array<object>} one row per control
 */
export function enumerateControlsInPage(viewId) {
  const view = document.getElementById(viewId)
  if (!view) return []
  const NATIVE = 'input,textarea,select,button,a[href],summary,[contenteditable=""],[contenteditable="true"]'
  const WIDGET_ROLES = new Set(['button', 'switch', 'radio', 'checkbox', 'tab', 'menuitem',
    'link', 'option', 'combobox', 'slider', 'textbox'])
  // Declared as content rather than as a control: not a widget, whatever class
  // it carries. The same set the door itself exempts.
  const NON_WIDGET_ROLES = new Set(['note', 'tooltip', 'status', 'img', 'presentation',
    'none', 'definition', 'term', 'separator', 'heading', 'paragraph', 'caption'])

  const seen = new Map()
  const out = []
  const push = (el, how) => {
    if (seen.has(el)) { const r = seen.get(el); if (!r.how.includes(how)) r.how += how; return }
    const cs = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const hit = (rect.width > 0 && rect.height > 0 && cx >= 0 && cy >= 0
      && cx <= innerWidth && cy <= innerHeight) ? document.elementFromPoint(cx, cy) : null
    // NOT `hit.contains(el)`. An ANCESTOR receiving the click is the proof the
    // control was NOT reached: that is what pointer-events:none does.
    const mouseReachable = !!hit && (hit === el || el.contains(hit))
    const ti = el.getAttribute('tabindex')
    const tag = el.tagName.toLowerCase()
    const keyboardReachable = el.disabled !== true
      && (ti === null ? /^(input|textarea|select|button|a|summary)$/.test(tag) : Number(ti) >= 0)
    const r = {
      how, tag,
      id: el.id || null,
      cls: (typeof el.className === 'string' ? el.className.slice(0, 60) : '') || null,
      text: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40),
      role: el.getAttribute('role'),
      // A disclosure declares itself with aria-expanded. Captured here so
      // classifyControl can read it - a classifier reading a field the
      // enumerator never produced is always `undefined`, which reads as
      // "not a disclosure" and would have silently reversed the exemption.
      ariaExpanded: el.getAttribute('aria-expanded'),
      tabindex: ti,
      disabled: el.disabled === true,
      ariaDisabled: el.getAttribute('aria-disabled'),
      pointerEvents: cs.pointerEvents,
      visible: rect.width > 0 && rect.height > 0 && cs.visibility !== 'hidden',
      mouseReachable,
      keyboardReachable,
      // A CONTAINER OF CONTROLS IS NOT A CONTROL - the same structural test the
      // door's own rule uses. A sub-tab panel carrying tabindex=0 as a focus
      // affordance was otherwise counted as a reachable write control.
      isContainer: !!el.querySelector(NATIVE),
      // THE THIRD CATEGORY: DECISIONS. `data-decision-track` is written only
      // inside the `mayDecide.has(track)` branch of the banner renderers, so
      // it IS the server's authorisation rather than a class anyone can add.
      // An approver is ALWAYS a non-owner and approving is the one action they
      // exist to take, so counting these as door gaps reports a working
      // control as a defect - the false pass the estate already recorded when
      // "0 actions clickable" was read as success.
      decision: !!(el.closest('[data-decision-track]') || el.hasAttribute('data-decision-track')),
      // Refresh changes nothing about the record.
      refresh: !!(el.closest('.appr-refresh') || el.classList?.contains('appr-refresh')),
    }
    seen.set(el, r)
    out.push(r)
  }

  // The door records what it neutralised. Reading that marker keeps treated
  // controls in the population: removing a tab stop removes the only property
  // a role-less, handler-less widget was enumerated by, so they would
  // otherwise VANISH rather than read as blocked.
  for (const el of view.querySelectorAll('[data-door-ti]')) push(el, 'D')
  for (const el of view.querySelectorAll(NATIVE)) push(el, 'N')
  for (const el of view.querySelectorAll('[data-probe-listener]')) push(el, 'L')
  for (const el of view.querySelectorAll('[role],[tabindex]')) {
    const role = el.getAttribute('role')
    if (role && NON_WIDGET_ROLES.has(role)) continue
    const ti = el.getAttribute('tabindex')
    if ((role && WIDGET_ROLES.has(role)) || (ti !== null && Number(ti) >= 0)) push(el, 'R')
  }
  for (const el of view.querySelectorAll('*')) {
    for (const a of el.getAttributeNames()) if (a.startsWith('on')) { push(el, 'A'); break }
  }
  return out
}

/**
 * Classify one enumerated control.
 *
 * SELF-CONTAINED ON PURPOSE. An earlier version split this into isNavigation,
 * isDisclosure and isWriteControl, where the third called the first two BY
 * NAME. That works in Node and throws in the page: page.evaluate serialises a
 * function's source, and the names it referred to do not exist in that scope.
 * One function that needs no companions serialises cleanly.
 *
 * @returns {{nav: boolean, disclosure: boolean, write: boolean, reachable: boolean}}
 */
export function classifyControl(r) {
  // Navigation must stay alive, or a read-only record stops being readable.
  const nav = !!(r.cls?.includes('detail-tab') || r.role === 'tab'
    || /back|close/i.test(r.text) || r.tag === 'a')
  // Reading more of a record you may not edit is still reading.
  // `ariaExpanded` FIRST: a disclosure declares itself, and P3 added collapsible
  // panels whose toggles carry it. One definition with the door, which exempts
  // the same attribute - two instruments disagreeing about what a disclosure IS
  // is the fault Verification 20 names, and it is why this is not a name list.
  const disclosure = !!(r.ariaExpanded !== null && r.ariaExpanded !== undefined)
    || !!(r.cls?.includes('help-dot') || r.id === 'btn-toggle-detail'
    || r.cls?.includes('disclose') || r.cls?.includes('latch')
    || /^(show|hide)\b/i.test(r.text) || /show details for/i.test(r.text))
  return {
    nav: nav || !!r.refresh,
    disclosure,
    decision: !!r.decision,
    // The population the door is about: write controls a person could operate.
    write: !nav && !disclosure && !r.decision && !r.refresh && r.visible && !r.isContainer,
    reachable: r.mouseReachable || r.keyboardReachable,
  }
}
