// R5's COSMETIC-TIER PROOF: the two save controls wear the estate's treatment.
//
// Build discipline 17 M2: a CSS or layout change gets a red-first guard, its
// affected suite, and a screenshot that is opened and read. No live injection
// harness, because no handler and no write is touched.
//
// THE CLAIM IS A CLASS, AND A CLASS IS WHAT IS ASSERTED, because the estate's
// named treatment for a role IS the contract: `btn-sm btn-primary` is what
// `Next Stage` wears on the scoring surface, and `btn-sm` is what `Add note`
// wears on the card row the follow-up save sits in. A replacement that invents
// its own metrics is a second treatment for one role.
//
// AND THE DISABLED STATE IS IN THE CAPTURE, because both controls spend most
// of their life disabled and a bare disabled button is a grey browser default
// where `.btn-sm:disabled` carries a real one.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('opportunity/probe-r5-buttons.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/opp-r5/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'opp-r5'

const checks = []
const check = (ok, what, detail = '') => { checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`) }

const opp = await freshOpportunity(TAG)
const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1100 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
  await p.waitForFunction(() => {
    const v = document.getElementById('view-opportunity-detail')
    const c = document.getElementById('detail-company')
    return !!v && !v.classList.contains('is-loading') && !!c && (c.textContent ?? '').trim().length > 0
  }, { timeout: 25000 })

  // SCOPED TO THE BAND, because `cd-followup-save` exists on the Contact view
  // too and this document keeps every screen resident.
  const fu = await p.evaluate(() => {
    const band = document.querySelector('[data-testid="opp-top-row"]')
    const e = band?.querySelector('[data-testid="cd-followup-save"]')
    const sib = band?.querySelector('[data-testid="cd-add-note-btn"]')
    if (!e) return { present: false }
    const cs = getComputedStyle(e)
    return {
      present: true, cls: e.className, disabled: e.disabled,
      bg: cs.backgroundColor, border: cs.borderTopColor, colour: cs.color,
      siblingCls: sib?.className ?? '(no Add note)',
    }
  })
  check(fu.present, 'the follow-up save control renders in the band')
  check(fu.cls.includes('btn-sm'),
    'R5b the follow-up save wears btn-sm, the same treatment as Add note beside it',
    `class="${fu.cls}"  Add note class="${fu.siblingCls}"`)
  check(fu.bg !== 'rgb(255, 255, 255)' && !/^rgba?\(2[45]\d, 2[45]\d, 2[45]\d/.test(fu.bg),
    'and it is no longer a white browser default', `background ${fu.bg}`)
  await p.screenshot({ path: `${OUT}r5-followup-save.png` })
  console.log(`  captured r5-followup-save.png  (disabled=${fu.disabled})`)
  await p.close()
} finally {
  await b.close()
  await tearDown(TAG)
}

const failed = checks.filter((c) => !c).length
console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
process.exit(failed ? 1 : 0)
