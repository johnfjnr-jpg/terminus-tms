// R8: the swapped contact surface, proven on an OWNED record.
//
// WHY OWNED. Phase 1's shot was a non-owner view, so every control was greyed
// and a parity judgement could not be made. 0 of the 11 live Qualified
// contacts belong to the probe identity, so the state is BUILT: created
// through the real route, then its status set by admin write. V47's clause -
// where one account cannot reach a state, build it and say so. The surface
// reads the state, not how the record arrived at it.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-r8-swap.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/contact-swap/`
mkdirSync(OUT, { recursive: true })
const TAG = process.argv[2] ?? 'r8'
const W = Number(process.argv[3] ?? 1440)
const MARK = 'R8FIXTURE'
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const db = admin()
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const checks = []
const check = (ok, what) => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`) }

try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('BUNDLE STALE'); process.exit(2) }

const inds = (await api('GET', '/industries')).data
const industry = inds[0]
const acct = must(await db.from('records').select('id')
  .eq('record_type', 'account').is('deleted_at', null).limit(1), 'acct')[0]

const made = await api('POST', '/contacts', {
  name: `${MARK} Ada`, company: `${MARK} Co`, jobRole: 'Head of Infrastructure',
  email: 'r8@example.com', mobile: '+60123456789', industry_id: industry.id, source: 'Web',
  linkedin: 'https://www.linkedin.com/in/r8/', address: '1 Fixture Street',
  address2: 'Level 2', city: 'Singapore', postcode: '018956',
  country: 'Singapore', region: 'APAC', summary: 'A fixture for the R8 parity check.',
})
const id = made.data?.id ?? made.data?.record?.id
// Qualified + linked, by admin write: the create-from section renders only on a
// Qualified contact, and the account section needs a parent to resolve.
must(await db.from('records').update({ status: 'Qualified', parent_record_id: acct.id })
  .eq('id', id), 'promote')
console.log(`fixture contact ${id}  (owned by the probe identity, Qualified, linked)\n`)

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: W, height: 1200 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate((r) => navigate('contact-detail', r), id)
  await page.waitForFunction(() => {
    const v = document.getElementById('view-contact-detail')
    return !!v && !v.classList.contains('hidden') && !!v.querySelector('[data-testid="contact-host"]')
  }, { timeout: 25000 })
  await new Promise((r) => setTimeout(r, 1500))
  await page.screenshot({ path: `${OUT}r8-owner-${TAG}-${W}.png`, fullPage: false })

  const seen = await page.evaluate(() => {
    const v = document.getElementById('view-contact-detail')
    const t = (x) => v.querySelector(`[data-testid="${x}"]`)
    const vis = (e) => { const r = e?.getBoundingClientRect(); return !!r && r.width > 0 && r.height > 0 }
    const inputs = [...v.querySelectorAll('input,select,textarea')].filter(vis)
    return {
      // THE NINE SLOTS
      back: !!t('cd-back'), actions: !!t('cd-actions'), status: !!t('cd-status'),
      heading: t('cd-lead-name')?.textContent ?? null,
      notes: !!t('cd-card-notes'), followUp: !!v.querySelector('[data-testid^="cd-followup"], [data-testid*="follow"]'),
      park: !!t('cd-btn-park'), link: !!t('cd-btn-link-account'),
      createSection: !!t('cd-create-section'),
      // THE SWAP
      gridCells: v.querySelectorAll('[data-key]').length,
      visibleInputs: inputs.length,
      enabledInputs: inputs.filter((e) => !e.disabled).length,
      contactCardClasses: [...(t('cd-card-contact')?.classList ?? [])].join(' '),
      accountCardClasses: [...(t('cd-card-account')?.classList ?? [])].join(' '),
      industryValue: (t('input-industry'))?.value ?? null,
      industryShown: (() => { const s = t('input-industry'); return s?.options?.[s.selectedIndex]?.textContent ?? null })(),
      accountText: t('cd-card-account')?.textContent?.slice(0, 80) ?? null,
      saveDisabled: t('save-all')?.disabled ?? null,
      height: Math.round(v.getBoundingClientRect().height),
    }
  })
  console.log(`  ${JSON.stringify(seen, null, 1).replace(/\n/g, '\n  ')}\n`)

  // ── THE NINE SLOTS SURVIVE ────────────────────────────────────────────
  for (const [k, label] of [['back', 'Back'], ['actions', 'stage actions'], ['status', 'status tag'],
    ['notes', 'notes history'], ['park', 'Park'], ['link', 'link account'],
    ['createSection', 'create-from section']]) {
    check(seen[k] === true, `slot survives: ${label}`)
  }
  check(seen.heading === `${MARK} Ada`, `slot survives: the 18pt heading (${seen.heading})`)
  check(seen.followUp === true, 'slot survives: follow-up task')

  // ── THE SWAP ITSELF ───────────────────────────────────────────────────
  check(seen.gridCells === 15, `all 15 census fields render (${seen.gridCells})`)
  check(seen.visibleInputs >= 14, `the record's fields are VISIBLE on load, not collapsed (${seen.visibleInputs})`)
  check(/pg-card/.test(seen.contactCardClasses), 'the field card carries the estate frame its siblings carry')
  check(seen.industryValue === industry.id, `Industry prefills (${seen.industryShown})`)
  check(/[A-Za-z]/.test(seen.accountText ?? ''), 'the account section resolves a name')
  check(seen.saveDisabled === true, 'Save starts disabled, because nothing is dirty')

  // ── THE DOOR, OWNER SIDE ──────────────────────────────────────────────
  check(seen.enabledInputs >= 14, `THE DOOR IS OPEN for the owner: ${seen.enabledInputs} of ${seen.visibleInputs} inputs editable`)

  // ── THE AUDIT TRAIL, the capability Round B measured a naive swap deleting
  const beforeNotes = (must(await db.from('record_revisions').select('payload')
    .eq('record_id', id).order('revision_number', { ascending: false }).limit(1), 'b')[0]
    ?.payload?.notes ?? []).length
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="input-city"]')
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(el, 'Kuala Lumpur')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.waitForFunction(() => {
    const b = document.querySelector('[data-testid="save-all"]'); return b && !b.disabled
  }, { timeout: 8000 })
  await page.click('[data-testid="save-all"]')
  await new Promise((r) => setTimeout(r, 2500))

  const after = must(await db.from('record_revisions').select('payload,revision_number')
    .eq('record_id', id).order('revision_number', { ascending: false }).limit(1), 'a')[0]
  const notes = after?.payload?.notes ?? []
  check(after?.payload?.city === 'Kuala Lumpur', `the edit SAVED (city = ${after?.payload?.city})`)
  check(notes.length === beforeNotes + 1, `exactly ONE note was added (${beforeNotes} -> ${notes.length})`)
  check(/City changed from Singapore to Kuala Lumpur/.test(notes[0]?.text ?? ''),
    `THE AUDIT TRAIL STILL WRITES: "${(notes[0]?.text ?? '').slice(0, 70)}"`)
  await page.screenshot({ path: `${OUT}r8-owner-saved-${TAG}-${W}.png`, fullPage: false })

  // ── THE DOOR, OTHER SIDE: the same screen on a record I do not own ─────
  const notMine = must(await db.from('records').select('id,owner_id')
    .eq('record_type', 'contact').eq('status', 'Qualified').is('deleted_at', null)
    .neq('owner_id', S.user.id).limit(1), 'nm')[0]
  await page.evaluate((r) => navigate('contact-detail', r), notMine.id)
  await page.waitForFunction((mine) => {
    const v = document.getElementById('view-contact-detail')
    return !!v && v.querySelector('[data-testid="cd-lead-name"]')?.textContent !== mine
  }, { timeout: 20000 }, `${MARK} Ada`)
  await new Promise((r) => setTimeout(r, 1500))
  const door = await page.evaluate(() => {
    const v = document.getElementById('view-contact-detail')
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const inputs = [...v.querySelectorAll('input,select,textarea')].filter(vis)
    return {
      visible: inputs.length,
      enabled: inputs.filter((e) => !e.disabled).length,
      backAlive: !v.querySelector('[data-testid="cd-back"]')?.disabled,
    }
  })
  console.log(`  non-owner: ${JSON.stringify(door)}`)
  check(door.visible >= 14, `the non-owner can still READ all the fields (${door.visible} visible)`)
  check(door.enabled === 0, `THE DOOR IS SHUT for a non-owner: ${door.enabled} of ${door.visible} editable`)
  check(door.backAlive === true, 'and the way OUT survives the door')
  await page.screenshot({ path: `${OUT}r8-nonowner-${TAG}-${W}.png`, fullPage: false })
} finally {
  await browser.close()
  const found = must(await db.from('record_revisions').select('record_id,payload')
    .ilike('payload->>name', `${MARK}%`), 'find')
  const ids = [...new Set(found.map((r) => r.record_id))]
  for (const r of ids) {
    must(await db.from('records').update({ deleted_at: new Date().toISOString() })
      .eq('id', r).is('deleted_at', null), 'soft')
  }
  const left = must(await db.from('records').select('id,deleted_at')
    .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']), 're')
  console.log(`\nteardown: ${left.length} found, ${left.filter((r) => !r.deleted_at).length} still live`)
}
const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} pass`)
process.exit(bad.length ? 1 : 0)
