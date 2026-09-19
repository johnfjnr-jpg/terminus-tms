// ── THE TEN RETIRED SITES, AS THE CASCADE ACTUALLY RESOLVES THEM ─────────
//
// Walk 3 Step 4, the V23 closure. The pure guard proves the stylesheet SAYS
// `var(--attention)` at all ten sites. That is a source scan, and a source scan
// cannot see a cascade: a later rule, a narrower selector or an undefined token
// would leave the declaration correct in the file and wrong on the screen.
//
// So this reads the COMPUTED colour in a real browser, on a real page, with the
// real stylesheet loaded.
//
// ── WHAT IS REACHED NATURALLY AND WHAT IS CONSTRUCTED, stated rather than
// blurred. `.cd-dirty` is driven to its real state by typing into a contact
// field. The other nine describe states this probe cannot manufacture in one
// session - a stalled pulse, a refused write, a rejected banner, a stale price
// catalog - so their classes are APPLIED to a real element inside the real
// document. That is honest for the claim being made, which is about the
// CASCADE rather than about the state machine: the question is what colour the
// class paints, and the answer does not depend on why the class is there.
//
// THE EXPECTED COLOUR IS READ FROM THE STYLESHEET, never typed here
// (Verification 20), so a retune of the token cannot leave this probe asserting
// a hex nobody uses any more.
//
// UNWIRED, and deliberately: it needs a browser, a live server and a signed-in
// session, and it creates a Contact. Cosmetic tier per build discipline 17 M2,
// so there is no live injection harness: no handler and no write is touched.
// Run: PUPPETEER_PATH=... node scripts/walk3/probe-amber-adopt.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-amber-adopt.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshContact, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk3/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
admin()
const TAG = 'w3amber'
const checks = []
const check = (ok, w) => { checks.push({ ok, w }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`) }

const css = readFileSync(`${ROOT}/frontend/style.css`, 'utf8')
const TOKEN = /--attention:\s*(#[0-9a-fA-F]{6})/.exec(css)?.[1]
if (!TOKEN) { console.error('no --attention in style.css'); process.exit(2) }
const RGB = `rgb(${[1, 3, 5].map((i) => parseInt(TOKEN.substr(i, 2), 16)).join(', ')})`
const OLD_RGB = 'rgb(224, 163, 62)'   // the retired #E0A33E
console.log(`--attention ${TOKEN} = ${RGB}; the retired amber was ${OLD_RGB}\n`)

// The ten, with which half of the treatment each one carries.
const SITES = [
  { cls: 'deal-basis-age deal-catalog-stale', prop: 'color', what: 'catalog stale' },
  { cls: 'deal-basis-age deal-catalog-undated', prop: 'color', what: 'catalog undated' },
  { cls: 'deal-schedule-off', prop: 'color', what: 'schedule off' },
  { cls: 'pulse-stall', prop: 'borderTopColor', what: 'pulse stall border' },
  { cls: 'pulse-stall-title', prop: 'color', what: 'pulse stall title' },
  { cls: 'rejected-banner', prop: 'borderTopColor', what: 'rejected banner border' },
  { cls: 'rejected-banner', inner: 'label', prop: 'color', what: 'rejected banner label' },
  { cls: 'write-refused', prop: 'borderTopColor', what: 'write refused border' },
  { cls: 'write-refused', inner: 'label', prop: 'color', what: 'write refused label' },
  { cls: 'cd-dirty', prop: 'color', what: 'contact unsaved count' },
]

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1200 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.waitForFunction(() => !!document.querySelector('#view-dashboard, #view-leads, nav'), { timeout: 30000 })

  // ── THE INSTRUMENT IS CALIBRATED BEFORE ITS ZEROS ARE QUOTED ──────────
  // A reader that returned the same string for everything would satisfy all ten
  // assertions below. Two controls: a token that does not exist must NOT
  // resolve to the attention colour, and --green must read as green.
  const control = await p.evaluate(() => {
    const mk = (decl) => {
      const el = document.createElement('div')
      el.style.cssText = decl
      document.body.appendChild(el)
      const c = getComputedStyle(el).color
      el.remove()
      return c
    }
    return { undef: mk('color: var(--no-such-token)'), green: mk('color: var(--green)') }
  })
  console.log(`  control: undefined token -> ${control.undef}, --green -> ${control.green}`)
  check(control.undef !== RGB, `an undefined token does NOT read as the attention colour (${control.undef})`)
  check(control.green !== RGB && control.green === 'rgb(102, 204, 153)',
    `--green still reads as green, so the reader discriminates (${control.green})`)

  const read = await p.evaluate((sites) => sites.map((s) => {
    const host = document.createElement('div')
    host.className = s.cls
    let target = host
    if (s.inner) {
      const kid = document.createElement('span')
      kid.className = s.inner
      host.appendChild(kid)
      target = kid
    }
    document.body.appendChild(host)
    const v = getComputedStyle(target)[s.prop]
    host.remove()
    return { what: s.what, value: v }
  }), SITES)

  for (const r of read) {
    check(r.value === RGB, `${r.what}: ${r.value}`)
    if (r.value === OLD_RGB) console.log('        ^ still the RETIRED amber')
  }

  // ── AND ONE OF THE TEN IN ITS REAL STATE, driven rather than constructed ──
  //
  // ON A CONTACT THE USER OWNS, and that is not a detail. The first version of
  // this probe took the first contact the API returned: ALL SEVENTEEN in the
  // database belong to somebody else, so the ownership door refused the row,
  // Enter opened nothing, the count stayed at 0, and `.cd-dirty` carries
  // `hidden` at 0. The probe then read the computed colour of a hidden element
  // and called it a pass.
  //
  // The door was right, the drive was right, and the FIXTURE was the fault
  // (Verification 47). `freshContact` creates one through the real route.
  const contacts = [ (await freshContact(TAG)).contactId ]
  if (contacts.length) {
    await p.evaluate((id) => navigate('contact-detail', id), contacts[0])
    await p.waitForFunction(() => {
      const v = document.getElementById('view-contact-detail')
      return !!v?.querySelector('[data-testid="contact-panel"]')
        && !!v.querySelector('[data-testid^="display-"]')
    }, { timeout: 30000 })
    // Type into the first editable row, which is what makes the unsaved count
    // appear. A real keystroke, and R-K's own Enter to commit it.
    // ── THE ROW MUST BE ON SCREEN, not merely in the document ────────────
    //
    // The first pass took the first `.field-row` in the DOM and typed into it.
    // Contact Details and Address are COLLAPSED BY DEFAULT, so that row was in
    // a closed section, the focus never landed, nothing was typed, and the
    // dirty count stayed at 0 - at which point `.cd-dirty` carries `hidden`.
    //
    // The probe then read the computed colour of a HIDDEN element and reported
    // it as a pass, with `inView` true because a hidden element reports a zero
    // rect at the top of the page. Verification 4's own sentence arriving
    // inside the instrument: presence is not visibility.
    const first = await p.evaluate(() => {
      const v = document.getElementById('view-contact-detail')
      const rows = Array.from(v.querySelectorAll('.field-row[data-field]:not([data-readonly])'))
      const open = rows.find((r) => {
        const d = r.querySelector('[data-testid^="display-"]')
        const b = d?.getBoundingClientRect()
        return !!b && b.width > 0 && b.height > 0
      })
      return open?.getAttribute('data-field') ?? null
    })
    if (first) {
      await p.focus(`[data-testid="display-${first}"]`)
      await p.keyboard.press('Enter')
      await p.waitForFunction((n) => document.activeElement?.getAttribute('data-testid') === `input-${n}`,
        { timeout: 10000 }, first).catch(() => false)
      await p.keyboard.press('End')
      await p.keyboard.type('Z')
      await p.keyboard.press('Enter')
      // WAIT ON THE COUNT BEING NON-ZERO, which is the only state that REVEALS
      // this element. Waiting on the selector is satisfied by the hidden one.
      await p.waitForFunction(() => {
        const el = document.querySelector('[data-testid="cd-dirty-indicator"]')
        return !!el && !el.hasAttribute('hidden')
      }, { timeout: 15000 }).catch(() => null)
      const live = await p.evaluate(() => {
        const el = document.querySelector('[data-testid="cd-dirty-indicator"]')
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { colour: getComputedStyle(el).color, text: el.textContent?.trim(),
          hidden: el.hasAttribute('hidden'), w: Math.round(r.width), h: Math.round(r.height),
          inView: r.top >= 0 && r.bottom <= window.innerHeight, top: Math.round(r.top) }
      })
      console.log(`  live .cd-dirty: ${JSON.stringify(live)}`)
      // THE VISIBILITY ASSERTIONS COME FIRST, because the colour of a hidden
      // element is a reading with nothing on either side.
      check(!!live && !live.hidden && live.w > 0 && live.h > 0,
        `the unsaved count is RENDERED, not merely present (${live?.w}x${live?.h}, hidden=${live?.hidden})`)
      check(!!live && /^1 unsaved change$/.test(live.text ?? ''),
        `and the edit really landed, so the state is real ("${live?.text}")`)
      check(!!live && live.colour === RGB,
        `IN ITS REAL STATE, the contact unsaved count is the attention colour (${live?.colour})`)
      check(!!live && live.inView, `and it is inside the captured region (top ${live?.top})`)
      await p.screenshot({ path: `${OUT}amber-1-cd-dirty-live.png` })
      console.log(`  screenshot: ${OUT}amber-1-cd-dirty-live.png`)
      // Leave the record as it was found: Escape reverts per A3.
      await p.keyboard.press('Escape')
    }
  } else {
    check(false, 'no contact was reachable to drive .cd-dirty into its real state')
  }

  // ── TWO MORE REPRESENTATIVE SITES, PHOTOGRAPHED ON THE REAL PAGE ──────
  // Constructed states, said so in the caption and in the report: these are
  // banner treatments (border plus label) and a text band, which is the third
  // shape the ten cover.
  for (const [n, spec] of [
    [2, { cls: 'write-refused', html: '<span class="label">Not saved.</span> The server refused this write.' }],
    [3, { cls: 'pulse-stall', html: '<span class="pulse-stall-title">This screen has stopped following the record.</span> Reload to catch up.' }],
  ]) {
    await p.evaluate((s) => {
      document.querySelectorAll('.walk3-shot').forEach((e) => e.remove())
      const main = document.querySelector('main') ?? document.body
      const box = document.createElement('div')
      box.className = 'walk3-shot'
      box.style.cssText = 'margin:24px; max-width:900px'
      box.innerHTML = `<div class="${s.cls}">${s.html}</div>`
      main.prepend(box)
      window.scrollTo(0, 0)
    }, spec)
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const seen = await p.evaluate((s) => {
      const el = document.querySelector(`.walk3-shot .${s.cls.split(' ')[0]}`)
      const r = el?.getBoundingClientRect()
      return el ? { border: getComputedStyle(el).borderTopColor,
        inView: !!r && r.top >= 0 && r.bottom <= window.innerHeight, h: Math.round(r.height) } : null
    }, spec)
    check(!!seen && seen.border === RGB, `${spec.cls} border is the attention colour (${seen?.border})`)
    check(!!seen && seen.inView && seen.h > 10, `${spec.cls} is in the captured region at ${seen?.h}px`)
    await p.screenshot({ path: `${OUT}amber-${n}-${spec.cls}.png` })
    console.log(`  screenshot: ${OUT}amber-${n}-${spec.cls}.png`)
  }
} finally {
  await b.close()
  await tearDown(TAG)
}

const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} checks PASS`)
process.exit(bad.length ? 1 : 0)
