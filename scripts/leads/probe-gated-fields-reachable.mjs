// R7: EVERY GATED FIELD HAS A REACHABLE EDITABLE INPUT.
//
// Ruled by John at the P3 close, after P3 found two fields gated at Qualify
// with no home in the ruled layout - `jobRole` absent entirely, and `name`
// turned into an 18pt heading, which is not editable.
//
// THE POPULATION IS THE SERVER'S OWN, not a list written here. It reads
// GET /records/:id/exit-criteria, the same derivation the gate itself uses, so
// this cannot pass by testing a stale copy of the requirements. If a migration
// adds a 16th gated field tomorrow and nobody gives it a row, this goes red.
//
// AND "REACHABLE" MEANS OPENED AND TYPED INTO, not present in the DOM. A row
// inside a collapsed panel is reachable - the panel opens - and a row that
// renders but refuses to open is not. The difference is exactly what P3's own
// door bug was.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-gated-fields-reachable.mjs')
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const TAG = 'r7gate'
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const call = async (m, p, b) => (await api(m, p, b)).data

try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('  bundle freshness FAILED - refusing to measure a stale bundle'); process.exit(2)
}

const browser = await puppeteer.launch({ headless: 'new' })
let fail = []
try {
  const industry = (await call('GET', '/industries'))[0]
  const lead = await call('POST', '/contacts', {
    name: `${TAG} Lead`, company: 'Gate Co', email: `${TAG}@example.invalid`,
    mobile: '+65 9000 0011', source: 'Direct Outreach', industry_id: industry.id,
  })

  // THE SERVER'S OWN ANSWER, for this record, right now.
  const crit = await call('GET', `/records/${lead.id}/exit-criteria`)
  const gated = crit.requirements
    .filter((r) => r.requirement_type === 'payload_field_required')
    .map((r) => r.field)
  console.log(`  gated at Qualify, per the server: ${gated.length}`)
  console.log(`    ${gated.join(', ')}\n`)

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1200 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate((id) => navigate('contact-detail', id), lead.id)
  await page.waitForFunction(() => {
    const v = document.getElementById('view-contact-detail')
    return !!v && !v.classList.contains('is-loading') && !!v.querySelector('[data-testid="cd-lead-name"]')
  }, { polling: 150, timeout: 30000 })

  // Open both collapsible panels. A collapsed row is reachable BECAUSE the
  // panel opens, so opening it is part of the claim rather than a shortcut.
  for (const t of ['cd-card-contact-toggle', 'cd-card-address-toggle']) {
    await page.evaluate((id) => document.querySelector(`[data-testid="${id}"]`)?.click(), t)
  }
  await page.waitForFunction(() => {
    const a = document.querySelector('[data-testid="cd-card-contact-body"]')
    const b = document.querySelector('[data-testid="cd-card-address-body"]')
    return !!a && !a.hasAttribute('hidden') && !!b && !b.hasAttribute('hidden')
  }, { polling: 50, timeout: 8000 })

  // Two gated keys are NOT payload rows and are satisfied elsewhere on the
  // screen. Declared, with the surface that satisfies each, so a third one
  // appearing is a red test rather than a silent exemption.
  const NOT_A_ROW = {
    parent_record_id: 'cd-card-account',   // the Account card and its Link control
    industry_id: 'display-industry',       // the Industry row, keyed by column name
  }

  console.log('  field                 row present  opens  accepts typing')
  console.log('  ' + '-'.repeat(62))
  for (const field of gated) {
    if (field in NOT_A_ROW) {
      const ok = await page.evaluate((t) => !!document.querySelector(`[data-testid="${t}"]`), NOT_A_ROW[field])
      console.log(`  ${field.padEnd(20)} ${ok ? 'satisfied by ' + NOT_A_ROW[field] : 'MISSING'}`)
      if (!ok) fail.push(`${field}: its declared surface ${NOT_A_ROW[field]} is not on the screen`)
      continue
    }
    const present = await page.evaluate((f) => !!document.querySelector(`[data-testid="display-${f}"]`), field)
    let opens = false
    let typed = false
    if (present) {
      await page.evaluate((f) => document.querySelector(`[data-testid="display-${f}"]`)?.click(), field)
      opens = await page.waitForFunction((f) => {
        const e = document.querySelector(`[data-testid="edit-${f}"]`)
        return !!e && !e.hasAttribute('hidden')
      }, { polling: 40, timeout: 4000 }, field).then(() => true).catch(() => false)
      if (opens) {
        // An editable INPUT, not merely an open container.
        typed = await page.evaluate((f) => {
          const w = document.querySelector(`[data-testid="input-${f}"]`)
          if (!w) return false
          const el = w.matches('input, select, textarea') ? w : w.querySelector('input, select, textarea')
          return !!el && !el.disabled && !el.readOnly
        }, field)
        await page.keyboard.press('Escape')
      }
    }
    console.log(`  ${field.padEnd(20)} ${String(present).padEnd(12)} ${String(opens).padEnd(6)} ${typed}`)
    if (!present) fail.push(`${field}: NO ROW on the screen, so the gate can never be satisfied here`)
    else if (!opens) fail.push(`${field}: the row does not open`)
    else if (!typed) fail.push(`${field}: opens but has no editable input`)
  }
  await page.close()
} finally {
  await browser.close()
  const swept = await tearDown(TAG)
  console.log(`\n  teardown: ${swept.removed.length} swept, ${swept.remaining} remaining`)
}

if (fail.length) { for (const f of fail) console.log('  FAILED  ' + f) }
else console.log('  PASS  every gated field has a reachable editable input')
process.exit(fail.length ? 1 : 0)
