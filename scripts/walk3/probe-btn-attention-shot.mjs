// ── THE THIRD AMBER ON A REAL BUTTON, IN ITS REAL STATE ──────────────────
//
// Walk 3, ruled 2026-09-19. The source guard proves `.btn-attention` binds the
// token and the adoption probe proves the cascade resolves it on a constructed
// element. Neither shows the treatment where a PERSON meets it.
//
// It is reachable: the park form nags on an accidental dismissal - a backdrop
// click with the form filled in - and that is what puts `btn-attention` on its
// Save. So this drives the real path rather than applying the class.
//
// MEASUREMENTS FIRST, CAPTURE SECOND, and the capture is of the PAGE.
//
// UNWIRED: it needs a browser, a live server and a signed-in session, and it
// creates a Contact.
// Run: PUPPETEER_PATH=... node scripts/walk3/probe-btn-attention-shot.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-btn-attention-shot.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshContact, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk3/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
admin()
const TAG = 'w3btn'
const C = '#view-contact-detail'
const checks = []
const check = (ok, w) => { checks.push({ ok, w }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`) }

// READ FROM THE STYLESHEET, never typed here (Verification 20).
const css = readFileSync(`${ROOT}/frontend/style.css`, 'utf8')
const TOKEN = /--attention:\s*(#[0-9a-fA-F]{6})/.exec(css)?.[1]
const RGB = `rgb(${[1, 3, 5].map((i) => parseInt(TOKEN.substr(i, 2), 16)).join(', ')})`
console.log(`--attention ${TOKEN} = ${RGB}\n`)

const c = await freshContact(TAG)
const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1200 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('contact-detail', id), c.contactId)
  const settle = (fn) => p.waitForFunction(fn, { timeout: 12000 }).catch(() => false)
  await settle(() => !!document.querySelector('#view-contact-detail [data-testid="cd-btn-park"]'))

  await p.click(`${C} [data-testid="cd-btn-park"]`)
  await settle(() => !!document.querySelector('#view-contact-detail [data-testid="cd-park-form"]'))
  await p.type(`${C} [data-testid="cd-park-date"]`, '12/31/2026')
  await p.type(`${C} [data-testid="cd-park-reason"]`, 'measuring the attention treatment')

  // The ACCIDENTAL dismissal: a click on the backdrop itself, which the form
  // refuses outright rather than acting on. That refusal is what nags.
  await p.evaluate((sel) => {
    const back = document.querySelector(`${sel} [data-testid="cd-park-form"]`)
    back.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }, C)
  await settle(() => !!document.querySelector('#view-contact-detail [data-testid="cd-park-unsaved-warning"]'))

  const m = await p.evaluate((sel) => {
    const v = document.querySelector(sel)
    const save = v.querySelector('[data-testid="cd-park-save"]')
    const warn = v.querySelector('[data-testid="cd-park-unsaved-warning"]')
    const cs = save && getComputedStyle(save)
    const r = save?.getBoundingClientRect()
    return {
      hasClass: save?.classList.contains('btn-attention') ?? false,
      border: cs?.borderTopColor ?? null,
      colour: cs?.color ?? null,
      shadow: cs?.boxShadow ?? null,
      warned: !!warn,
      nagClass: warn?.className ?? null,
      nagColour: warn ? getComputedStyle(warn).color : null,
      nagText: warn?.textContent?.trim() ?? null,
      w: r ? Math.round(r.width) : null, h: r ? Math.round(r.height) : null,
      inView: !!r && r.top >= 0 && r.bottom <= window.innerHeight,
      formOpen: !!v.querySelector('[data-testid="cd-park-form"]'),
    }
  }, C)
  console.log(`  ${JSON.stringify(m)}`)

  check(m.formOpen, 'the form stayed open, so the backdrop click was REFUSED rather than acted on')
  check(m.warned, 'and it said why, which is the state that raises the treatment')
  // ── THE NAG IS A WARNING, NOT AN ERROR. Ruled 2026-09-19 ────────────
  check(m.nagClass === 'msg-warning',
    `the refusal wears the warning treatment, not the error one (${m.nagClass})`)
  check(m.nagColour === RGB,
    `so it renders in the attention amber rather than red (${m.nagColour})`)
  check(m.nagText === 'There is unsaved work here. Save and park, or cancel.',
    `and the WORDING is unchanged ("${m.nagText}")`)
  check(m.hasClass, 'the Save button carries btn-attention IN ITS REAL STATE')
  check(m.border === RGB, `its border is the attention colour (${m.border})`)
  check(m.colour === RGB, `its text is the attention colour (${m.colour})`)
  // The glow, whichever way the browser spells it.
  const rgbNums = RGB.replace(/[^\d,]/g, '')
  const glow = (() => {
    const s = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?/.exec(m.shadow ?? '')
    if (s) return { rgb: s.slice(1, 4).map((v) => Math.round(Number(v) * 255)).join(','), a: Number(s[4] ?? 1) }
    const r = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(m.shadow ?? '')
    return r ? { rgb: r.slice(1, 4).map(Number).join(','), a: Number(r[4] ?? 1) } : null
  })()
  check(!!glow && glow.rgb === rgbNums && glow.a > 0 && glow.a < 1,
    `and its glow derives from the same token at partial alpha (${JSON.stringify(glow)})`)
  // CONFIRM THE ELEMENT IS IN THE CAPTURE before the image counts as evidence.
  check(m.inView && (m.w ?? 0) > 40 && (m.h ?? 0) > 10,
    `the button is in the captured region at ${m.w}x${m.h}`)

  const shot = `${OUT}btn-attention-1440-${c.contactId.slice(0, 8)}.png`
  await p.screenshot({ path: shot })
  console.log(`\n  screenshot: ${shot}`)
} finally {
  await b.close()
  console.log(`  teardown: ${JSON.stringify(await tearDown(TAG))}`)
}

const bad = checks.filter((x) => !x.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} checks PASS`)
process.exit(bad.length ? 1 : 0)
