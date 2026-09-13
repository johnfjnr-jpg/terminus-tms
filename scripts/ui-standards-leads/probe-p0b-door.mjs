// The consequence of the Address button's aria-controls exemption, measured
// on an UNOWNED lead. The button carries aria-controls pointing at an element
// that does not exist, and [aria-controls] is in the door's exemption list -
// so the button survives the door. The question is what it opens, and whether
// what it opens can WRITE.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p0b-door.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { admin } from '../fixtures.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/usl/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const OTHER = JSON.parse(readFileSync(`${ROOT}/session-ref-approver.json`, 'utf8'))
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const industry = must(await db.from('industries').select('id').limit(1), 'i')[0]
// A record the user can SEE and must not EDIT, built by admin write with a
// real second auth.users id - Verification 47's clause.
const r = must(await db.from('records').insert({ record_type: 'contact', status: 'Unqualified',
  owner_id: OTHER.user.id, industry_id: industry.id }).select().single(), 'lead')
must(await db.from('record_revisions').insert({ record_id: r.id, revision_number: 1,
  payload: { name: 'usl0b Unowned', company: 'Standards Co', source: 'Referral',
    summary: 'Someone else owns this.', address: '1 Way', city: 'Singapore' },
  created_by: OTHER.user.id }).select().single(), 'rev')

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1200 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate(() => navigate('leads'))
  await page.waitForFunction((x) => !!document.querySelector(`[data-testid="lead-card-${x}"]`), { timeout: 25000 }, r.id)

  const state = await page.evaluate((x) => {
    const card = document.querySelector(`[data-testid="lead-card-${x}"]`)
    const d = (t) => { const e = card.querySelector(`[data-testid="${t}"]`); return e ? e.disabled : null }
    return { notMine: card.dataset.notMine, qualify: d(`lead-qualify-${x}`),
      nurture: d(`lead-nurture-${x}`), followup: d(`lead-followup-btn-${x}`),
      address: d(`lead-address-${x}`),
      ariaTargetExists: !!document.getElementById(`lead-address-panel-${x}`) }
  }, r.id)
  console.log(`  unowned card: notMine=${state.notMine}`)
  console.log(`    qualify   disabled ${state.qualify}`)
  console.log(`    nurture   disabled ${state.nurture}`)
  console.log(`    follow-up disabled ${state.followup}`)
  console.log(`    ADDRESS   disabled ${state.address}   <<< exempt via aria-controls`)
  console.log(`    its aria-controls target exists: ${state.ariaTargetExists}`)

  if (state.address === false) {
    await page.click(`[data-testid="lead-address-${r.id}"]`)
    await new Promise((x) => setTimeout(x, 700))
    const inside = await page.evaluate((x) => {
      const p = document.querySelector(`[data-testid="address-popup-${x}"]`)
      if (!p) return { opened: false }
      const ctl = [...p.querySelectorAll('button, input, textarea, select')]
      return { opened: true, total: ctl.length,
        live: ctl.filter((e) => !e.disabled).map((e) => e.dataset.testid || e.tagName.toLowerCase()),
        saveDisabled: p.querySelector(`[data-testid="addr-save-${x}"]`)?.disabled ?? null,
        closeDisabled: p.querySelector(`[data-testid="addr-close-${x}"]`)?.disabled ?? null }
    }, r.id)
    console.log(`\n  the popup OPENED on an unowned lead: ${inside.opened}`)
    if (inside.opened) {
      console.log(`    controls ${inside.total}, still live: ${inside.live.length ? inside.live.join(' ') : 'none'}`)
      console.log(`    Save disabled  ${inside.saveDisabled}`)
      console.log(`    Close disabled ${inside.closeDisabled}   (must stay alive: V43's leave-control clause)`)
      const el = await page.$(`[data-testid="lead-card-${r.id}"]`)
      if (el) await el.screenshot({ path: `${OUT}usl-p0b-unowned-address.png` })
    }
  }
} finally {
  await browser.close()
  await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', r.id)
  const live = must(await db.from('records').select('id').eq('id', r.id).is('deleted_at', null), 'td')
  console.log(`\nteardown: 1 soft-deleted, ${live.length} still live`)
}
