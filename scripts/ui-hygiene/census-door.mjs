// THE DOOR CENSUS. UI hygiene v2, R2a, Phase 0. READ-ONLY against product code.
//
// ── WHY THIS DOES NOT READ SELECTORS ──────────────────────────────────────
//
// The brief is explicit: enumerate by INTERACTION, not by reading selectors.
// The estate's existing door probe (probe-readonly-view.mjs) enumerates from
// an allowlist - `input, textarea, select` plus four class names - and the
// parked round's own finding is that the ring-radio structure picker "appears
// in no door selector". An allowlist cannot report what it does not name, so
// asking it about coverage is asking it about itself.
//
// ── THE INSTRUMENT THAT CAN SEE A HANDLER ─────────────────────────────────
//
// A div with an onclick is invisible in the DOM: nothing distinguishes it from
// a div. So addEventListener is WRAPPED BEFORE THE DOCUMENT EXISTS, via
// evaluateOnNewDocument, and every element that receives an activating handler
// is tagged as it is registered. Verification 45: a sampler attached after load
// starts at the second state, and here it would miss every handler bound during
// the page's own boot, which is all of them.
//
// Four instruments, unioned, each recorded per control so a claim of absence
// names what could have seen the thing:
//   L  a direct activating listener, seen at registration
//   N  a natively interactive tag
//   R  an ARIA role or a focusable tabindex
//   A  an inline on* attribute
//
// Delegated handlers bound to document or body tag NOTHING, and that is a
// stated limit of this census rather than a silence: see the DELEGATION note
// in the output.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('census-door.mjs')
import { readFileSync, mkdirSync, writeFileSync } from 'fs'
// A long browser run outlived the session twice in one round, each time
// mid-measurement. This checks liveness periodically and refreshes only when
// the session file agrees the token is near expiry; a refused read on a
// healthy-looking file is a REVOKED token and stops the run loudly rather than
// being retried into silence.
import { startKeepAlive } from '../lib/keep-alive.mjs'
const keepAlive = startKeepAlive({ everyMs: 60000 })

const ROOT = '/Users/johnfryatt/terminus-tms'
const session = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const OUT = `${ROOT}/.verify/door-census/`
mkdirSync(OUT, { recursive: true })

const NOT_MINE = process.env.PROBE_OPP ?? 'd86369b3-f1a7-4c79-bb50-4d4ac49d42fa'
const { freshOpportunity, tearDown } = await import('../fixtures.mjs')
const TAG = 'doorcensus'
const { oppId: MINE } = await freshOpportunity(TAG)

// TWO RECORDS IS THE INSTRUMENT (Verification 17). A census of only the
// unowned record would report "everything is locked" against a build that
// locks everything, including your own deals, and call it coverage.
const RECORDS = [{ label: 'not mine', id: NOT_MINE }, { label: 'mine', id: MINE }]

const INSTRUMENT = `
window.__probeControls = new WeakMap();
window.__probeSeq = 0;
const ACTIVATING = new Set(['click','keydown','keyup','mousedown','pointerdown','change','input','dblclick']);
const orig = EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener = function (type, fn, opts) {
  try {
    if (ACTIVATING.has(type) && this instanceof Element) {
      const cur = window.__probeControls.get(this) || new Set();
      cur.add(type);
      window.__probeControls.set(this, cur);
      this.setAttribute('data-probe-listener', [...cur].join(','));
    }
  } catch (e) { /* never break the page being measured */ }
  return orig.call(this, type, fn, opts);
};
window.__probeMutations = 0;
window.addEventListener('DOMContentLoaded', () => {
  new MutationObserver((ms) => { window.__probeMutations += ms.length; })
    .observe(document.documentElement, { subtree: true, childList: true,
      attributes: true, characterData: true });
});
`

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
const rows = []
const meta = {}

for (const rec of RECORDS) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.evaluateOnNewDocument(INSTRUMENT)
  // The estate's own boot sequence, taken from probe-readonly-view.mjs rather
  // than invented: the Supabase auth key, then a RELOAD so the app boots with
  // the session present, then navigate(view, id) - two arguments, not a path.
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate((rid) => navigate('opportunity-detail', rid), rec.id)
  // Verification 7's counterfactual: #view-opportunity-detail EXISTS either
  // way, so its presence proves nothing. The display name is written by the
  // record's own render, is empty before it, and DIFFERS between the two
  // records - so it is a condition the previous state cannot satisfy.
  //
  // NOT `a || b`. #ref-display-name EXISTS on this view and is permanently
  // EMPTY, so `getElementById(a) || getElementById(b)` returns the empty one
  // and the condition can never be true. probe-readonly-view.mjs carries this
  // exact wait and survives it only because it is followed by
  // `.catch(() => {})`, which means that probe proceeds without waiting at
  // all. Recorded as a Phase 0 finding rather than copied.
  //
  // AND THE DATA ARRIVING IS NOT THE RENDER FINISHING. Measured: the record's
  // company name appears at ~2.5s while the view still carries `is-loading`,
  // and `is-loading` clears at ~4.0s. In that 1.5s window the loading veil
  // sets `visibility: hidden` on the content, so a census taken on the
  // data-arrived condition measures the veil and reports every control
  // invisible - which it did, as a uniform and entirely plausible zero on
  // BOTH records.
  //
  // So the wait is on the state being measured: the veil GONE and the record
  // present.
  await page.waitForFunction(() => {
    const v = document.getElementById('view-opportunity-detail')
    if (!v || v.classList.contains('is-loading')) return false
    const els = ['ref-display-name', 'detail-company'].map((i) => document.getElementById(i))
    return els.some((el) => el && el.textContent.trim().length > 0)
  }, { timeout: 30000 })

  // THE TABS, by the shape they actually have. The first version of this
  // enumerated `.detail-tab` correctly and then DISCARDED every one of them
  // for lacking a `data-tab` attribute, and reported "tabs seen: (none)" -
  // a census of one tab wearing the shape of a census of all of them.
  const tabs = await page.evaluate(() => {
    const v = document.getElementById('view-opportunity-detail')
    return [...v.querySelectorAll('#opp-detail-tabs button.detail-tab')]
      .map((t) => ({ id: t.id, text: (t.textContent ?? '').trim() }))
  })
  meta[rec.label] = { tabs: tabs.map((t) => t.text) }

  for (const tab of tabs) {
    await page.evaluate((id) => document.getElementById(id)?.click(), tab.id)
    // One interaction, then YIELD, then assert. A synchronous read after a
    // synchronous dispatch measures the previous frame.
    await page.waitForFunction((id) => {
      const b = document.getElementById(id)
      return b && b.classList.contains('active')
    }, { timeout: 10000 }, tab.id).catch(() => {})
    await new Promise((r) => setTimeout(r, 500))

    const found = await page.evaluate((tabText) => {
      const v = document.getElementById('view-opportunity-detail')
      if (!v) return []
      // Only the VISIBLE panel plus the shared action bar: a hidden panel's
      // controls are not reachable and counting them would inflate every
      // number in this census.
      const scopes = [...v.querySelectorAll('.detail-tab-panel')].filter((p) => !p.hidden && p.offsetParent !== null)
      scopes.push(...v.querySelectorAll('#opp-tab-actions, #opp-detail-tabs'))
      const NATIVE = 'input,textarea,select,button,a[href],summary,[contenteditable=""],[contenteditable="true"]'
      const ROLES = new Set(['button','switch','radio','checkbox','tab','menuitem','link','option','combobox','slider','textbox'])
      const out = []
      const seen = new Map()
      const push = (el, how) => {
        if (seen.has(el)) { const r = seen.get(el); if (!r.how.includes(how)) r.how += how; return }
        const cs = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        // CAN A MOUSE ACTUALLY REACH IT. pointer-events is the property, and
        // elementFromPoint is the only honest test of it: if the point at the
        // control's centre resolves to something else, a person's click lands
        // on that something else.
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2
        const hit = (rect.width > 0 && rect.height > 0 && cx >= 0 && cy >= 0
          && cx <= innerWidth && cy <= innerHeight) ? document.elementFromPoint(cx, cy) : null
        // NOT `hit.contains(el)`. An ANCESTOR receiving the click is the
        // proof the control was NOT reached: that is exactly what
        // pointer-events:none does. Including it reported every
        // pointer-events:none control as mouse reachable, which is why the
        // first reading showed 42 on the unowned record against 41 on the
        // owned one - a door doing nothing would produce the same pair.
        const reachable = !!hit && (hit === el || el.contains(hit))
        const ti = el.getAttribute('tabindex')
        const focusable = el.disabled !== true && (ti === null ? /^(input|textarea|select|button|a|summary)$/.test(el.tagName.toLowerCase()) : Number(ti) >= 0)
        const r = {
          how, tab: tabText,
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          cls: (typeof el.className === 'string' ? el.className.slice(0, 60) : '') || null,
          text: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 34),
          listener: el.getAttribute('data-probe-listener'),
          role: el.getAttribute('role'),
          tabindex: ti,
          disabled: el.disabled === true,
          ariaDisabled: el.getAttribute('aria-disabled'),
          pointerEvents: cs.pointerEvents,
          visible: rect.width > 0 && rect.height > 0 && cs.visibility !== 'hidden',
          mouseReachable: reachable,
          keyboardReachable: focusable,
          isContainer: !!el.querySelector(NATIVE),
        }
        seen.set(el, r); out.push(r)
      }
      for (const scope of scopes) {
        for (const el of scope.querySelectorAll(NATIVE)) push(el, 'N')
        for (const el of scope.querySelectorAll('[data-probe-listener]')) push(el, 'L')
        for (const el of scope.querySelectorAll('[role],[tabindex]')) {
          const r = el.getAttribute('role'), ti = el.getAttribute('tabindex')
          if ((r && ROLES.has(r)) || (ti !== null && Number(ti) >= 0)) push(el, 'R')
        }
        for (const el of scope.querySelectorAll('*')) {
          for (const a of el.getAttributeNames()) if (a.startsWith('on')) { push(el, 'A'); break }
        }
      }
      return out
    }, tab.text)

    for (const c of found) rows.push({ record: rec.label, ...c })
  }
  await page.close()
}

await browser.close()
await tearDown(TAG)

writeFileSync(`${OUT}controls.json`, JSON.stringify({ meta, rows }, null, 2))

const notMine = rows.filter((r) => r.record === 'not mine')
const mine = rows.filter((r) => r.record === 'mine')

// A WRITE CONTROL IS THE POPULATION THE DOOR IS ABOUT. Navigation must keep
// working on a record you cannot edit, or a read-only record stops being
// readable, so tabs and Back are counted separately rather than as failures.
// NAMED EXCEPTIONS, with the reason, rather than a silent filter. The brief
// asks for controls that must stay alive to be named: navigation, because a
// read-only record must stay readable; disclosure, because reading more of a
// record you may not edit is still reading; and help, for the same reason.
const NAV = (r) => r.cls?.includes('detail-tab') || r.role === 'tab'
  || /back|close/i.test(r.text) || r.tag === 'a'
// Identity can live in the ID rather than the class: #btn-toggle-detail carries
// class `btn-text disclose`, so a class-only classifier never saw it.
const DISCLOSURE = (r) => r.cls?.includes('help-dot')
  || r.id === 'btn-toggle-detail' || r.cls?.includes('disclose') || r.cls?.includes('latch')
  || /^(show|hide)\b/i.test(r.text) || /show details for/i.test(r.text)
const BENIGN = (r) => NAV(r) || DISCLOSURE(r)
const reach = (r) => r.mouseReachable || r.keyboardReachable

// A CONTAINER OF CONTROLS IS NOT A CONTROL - the same structural test the
// door's own rule uses. Without it the census counted
// #opp-assessment-mount-pane-commercial, a sub-tab panel carrying tabindex=0
// as a focus affordance, as a reachable WRITE control.
const write = notMine.filter((r) => !BENIGN(r) && r.visible && !r.isContainer)
const liveWrite = write.filter(reach)
const mineWrite = mine.filter((r) => !BENIGN(r) && r.visible && !r.isContainer)
const mineLive = mineWrite.filter(reach)

console.log(`\n  DOOR CENSUS. Enumerated by instrument, reachability by hit test.\n`)
console.log(`  tabs censused: ${(meta['not mine']?.tabs ?? []).join(', ') || '(none)'}`)
console.log(`\n  ${'population'.padEnd(42)} not mine   mine`)
const line = (l, a, b) => console.log(`  ${l.padEnd(42)} ${String(a).padEnd(10)} ${b}`)
line('candidates enumerated', notMine.length, mine.length)
line('  navigation (must stay alive)', notMine.filter(NAV).length, mine.filter(NAV).length)
line('  disclosure and help (must stay alive)', notMine.filter((r) => DISCLOSURE(r) && !NAV(r)).length, mine.filter((r) => DISCLOSURE(r) && !NAV(r)).length)
// ── AND HOW MANY OF THEM ARE STILL REACHABLE ────────────────────────────
//
// The count above is a POPULATION: those elements still exist when a panel is
// killed, they simply stop working, so it cannot see a container-level kill.
// A calibration keyed on it read 37 -> 37 while the whole Commercials panel
// was dead.
//
// A DETECTOR MUST NOT BE KEYED ON A NUMBER THE DEFECT LEAVES ALONE - and a
// container kill also makes the headline REACHABLE count fall, which looks
// like an improvement. This is the line that moves the right way: read
// affordances a person can still operate.
const reachDisc = (set) => set.filter((r) => DISCLOSURE(r) && !NAV(r) && r.visible && reach(r)).length
line('  of those, still REACHABLE', reachDisc(notMine), reachDisc(mine))
line('  of which visible write controls', write.length, mineWrite.length)
line('REACHABLE write controls', liveWrite.length, mineLive.length)
line('  reachable by MOUSE', write.filter((r) => r.mouseReachable).length, mineWrite.filter((r) => r.mouseReachable).length)
line('  reachable by KEYBOARD', write.filter((r) => r.keyboardReachable).length, mineWrite.filter((r) => r.keyboardReachable).length)

console.log(`\n  BY TAB, reachable write controls on the UNOWNED record:`)
for (const t of meta['not mine']?.tabs ?? []) {
  const n = liveWrite.filter((r) => r.tab === t)
  console.log(`    ${t.padEnd(16)} ${n.length}`)
}

console.log(`\n  HOW EACH REACHABLE WRITE CONTROL WAS FOUND (claim of absence names the instrument):`)
const byHow = {}
for (const r of liveWrite) byHow[r.how] = (byHow[r.how] ?? 0) + 1
for (const [h, n] of Object.entries(byHow).sort()) console.log(`    ${h.padEnd(6)} ${n}`)
console.log('    L direct listener | N native tag | R role or tabindex | A inline on*')

console.log(`\n  THE REACHABLE WRITE CONTROLS, which is the inventory Phase 1 must close:`)
const shown = liveWrite.slice(0, 40)
for (const r of shown) {
  console.log(`    [${r.how.padEnd(3)}] ${(r.tab ?? '').padEnd(13)} ${r.tag.padEnd(8)} ` +
    `${(r.id ?? r.cls ?? '').slice(0, 34).padEnd(34)} pe=${r.pointerEvents.padEnd(5)} ` +
    `${r.mouseReachable ? 'MOUSE' : '     '} ${r.keyboardReachable ? 'KEY' : '   '} ${r.text}`)
}
if (liveWrite.length > shown.length) console.log(`    ... and ${liveWrite.length - shown.length} more, all in controls.json`)

console.log(`\n  DELEGATION, a stated limit rather than a silence: a handler bound to`)
console.log(`  document or body tags no element, so a control driven only by delegation`)
console.log(`  is invisible to instrument L. It is still caught by N, R or A if it is a`)
console.log(`  native tag, carries a role or tabindex, or has an inline on* attribute.`)
console.log(`\n  written: ${OUT}controls.json`)
