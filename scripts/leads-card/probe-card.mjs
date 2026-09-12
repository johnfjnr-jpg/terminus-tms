// Phase 2: the card, on the live screen after rebuild.
//
// TWO CARDS IS THE INSTRUMENT. The door claim needs an owned card AND an
// unowned one in the same render, or "every control is neutralised" is a
// reading of a screen with nothing on it to neutralise.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-card.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/leads-card/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const TAG = 'p2card'
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const results = []
const check = (n, pass, d) => { results.push({ n, pass }); console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${n}`); if (d) console.log(`        ${d}`) }

try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('  bundle freshness FAILED'); process.exit(2)
}

const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
const OTHER_ID = users.users.find((u) => u.email === 'john+test2@terminustechnologies.io')?.id
if (!OTHER_ID) throw new Error('no second identity; refusing to fake an owner id')
const OWNER_ID = OWNER.user.id
const industry = must(await db.from('industries').select('id').limit(1), 'industry')[0]

const COMPLETE = {
  company: 'Card Co', jobRole: 'Head of Ops', email: `${TAG}@example.invalid`,
  mobile: '+65 9000 0122', source: 'Direct Outreach', linkedin: 'https://example.invalid/in/x',
  address: '1 Card Way', city: 'Singapore', postcode: '069118',
  country: 'Singapore', region: 'APAC', summary: 'complete on the card',
}
const makeLead = async (label, payload, ownerId = OWNER_ID) => {
  const rec = must(await db.from('records').insert({
    record_type: 'contact', status: 'Unqualified', owner_id: ownerId,
    parent_record_id: null, industry_id: industry.id,
  }).select().single(), `lead ${label}`)
  must(await db.from('record_revisions').insert({
    record_id: rec.id, revision_number: 1,
    payload: { ...payload, name: `${TAG} ${label}` }, created_by: ownerId,
  }).select().single(), `rev ${label}`)
  return rec
}
const created = []
const complete = await makeLead('Complete', COMPLETE); created.push(complete.id)
const partial = await makeLead('Partial', { company: 'Card Co', summary: 'missing lots' }); created.push(partial.id)
const theirs = await makeLead('Theirs', COMPLETE, OTHER_ID); created.push(theirs.id)

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1200 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  page.on('pageerror', (e) => console.log(`        [pageerror] ${e.message}`))
  const toLeads = async () => {
    await page.evaluate(() => navigate('leads'))
    await page.waitForFunction((id) => !!document.querySelector(`[data-testid="lead-card-${id}"]`),
      // `partial`, NOT `complete`: after the conversion the complete lead is
      // Qualified and has correctly LEFT the pipeline, so waiting for its card
      // waits forever. The first run timed out here on the product working.
      { timeout: 20000 }, partial.id)
  }
  await toLeads()

  // ── FULL WIDTH ────────────────────────────────────────────────────────
  const widths = await page.evaluate((id) => {
    const card = document.querySelector(`[data-testid="lead-card-${id}"]`)
    const view = document.getElementById('view-leads')
    return {
      card: Math.round(card.getBoundingClientRect().width),
      view: Math.round(view.getBoundingClientRect().width),
      viewport: window.innerWidth,
      maxWidth: getComputedStyle(view).maxWidth,
    }
  }, complete.id)
  check('the view is full width, not capped at 1240',
    widths.maxWidth === 'none' && widths.card > 1500,
    `max-width ${widths.maxWidth}, card ${widths.card}px in a ${widths.viewport}px viewport`)

  // ── THE NAME LINE ─────────────────────────────────────────────────────
  const head = await page.evaluate((id) => {
    const h = document.querySelector(`[data-testid="lead-card-${id}"] .lead-card-head`)
    const name = h.querySelector('.lead-card-name').getBoundingClientRect()
    const sub = h.querySelector('.lead-card-sub')
    return { sameRow: Math.abs(name.top - sub.getBoundingClientRect().top) < 6, text: sub.textContent }
  }, complete.id)
  check('Company, Source and Created Date sit ON the lead name line',
    head.sameRow && head.text.split('·').length === 3,
    `"${head.text.trim()}" shares the name's row: ${head.sameRow}`)

  // ── THE FOUR ACTIONS ──────────────────────────────────────────────────
  const actions = await page.evaluate((id) => ['qualify', 'nurture', 'followup-btn', 'address']
    .map((k) => !!document.querySelector(`[data-testid="lead-${k}-${id}"]`)), complete.id)
  check('all four card actions render', actions.every(Boolean), `Qualify/Nurture/Follow-up/Address: ${actions}`)

  // ── QUALIFY ON AN INCOMPLETE LEAD -> the SERVER'S list ────────────────
  await page.click(`[data-testid="lead-qualify-${partial.id}"]`)
  await page.waitForSelector(`[data-testid="lead-incomplete-${partial.id}"]`, { timeout: 15000 })
  const missing = await page.$$eval(`[data-testid="lead-missing-${partial.id}"] li`,
    (li) => li.map((x) => x.textContent.trim()))
  // Through the throwing client, not a raw fetch: the guard caught this
  // shape twice in two rounds and the reason holds here too - a non-2xx from
  // the server side of this comparison would otherwise be silent, and the
  // comparison would pass on two empty lists.
  const server = await api('GET', `/records/${partial.id}/exit-criteria`)
  const serverFields = (server.data.blocking ?? []).map((b) => b.message ?? b.label ?? b.field)
  check('the completion popup names the SERVER\'S blocking list, not a client copy',
    missing.length === serverFields.length && missing.length > 0
      && missing.every((m) => serverFields.includes(m)),
    `popup ${missing.length}, server ${serverFields.length}: ${missing.slice(0, 4).join(', ')}...`)
  await page.screenshot({ path: `${OUT}p2-incomplete.png` })
  await page.click(`[data-testid="lead-incomplete-close-${partial.id}"]`)

  // ── R8: CANCEL AT THE ACCOUNT STEP WRITES NOTHING ─────────────────────
  const fingerprint = async (id) => {
    const r = must(await db.from('records').select('status, parent_record_id').eq('id', id).single(), 'fp')
    const a = must(await db.from('records').select('id').eq('record_type', 'account').is('deleted_at', null), 'fp a')
    return { ...r, accounts: a.length }
  }
  const beforeCancel = await fingerprint(complete.id)
  await page.click(`[data-testid="lead-qualify-${complete.id}"]`)
  await page.waitForSelector(`[data-testid="lead-account-step-${complete.id}"]`, { timeout: 15000 })
  await page.screenshot({ path: `${OUT}p2-account-step.png` })
  // ONE Cancel, the panel's. The card rendered a second one in the first
  // build and the screenshot showed them side by side.
  const cancels = await page.$$eval(`[data-testid="lead-account-step-${complete.id}"] button`,
    (b) => b.filter((x) => /cancel/i.test(x.textContent)).length)
  check('the account step has exactly ONE Cancel, not two', cancels === 1, `${cancels} cancel button(s)`)
  await page.click('[data-testid="cd-link-cancel"]')
  await page.waitForFunction((id) => !document.querySelector(`[data-testid="lead-account-step-${id}"]`),
    {}, complete.id)
  const afterCancel = await fingerprint(complete.id)
  check('R8: cancelling the account step wrote NOTHING',
    JSON.stringify(beforeCancel) === JSON.stringify(afterCancel)
      && afterCancel.status === 'Unqualified',
    `before ${JSON.stringify(beforeCancel)} after ${JSON.stringify(afterCancel)}`)

  // ── QUALIFY END TO END, ONE ATOMIC CALL ───────────────────────────────
  const calls = []
  page.on('request', (r) => {
    const u = r.url()
    if (r.method() === 'POST' && /\/api\/contacts\//.test(u)) calls.push(u.split('/api')[1])
  })
  await page.click(`[data-testid="lead-qualify-${complete.id}"]`)
  await page.waitForSelector(`[data-testid="lead-account-step-${complete.id}"]`, { timeout: 15000 })
  const NAME = `${TAG} Account From Card`
  await page.type('[data-testid="cd-link-search"]', NAME)
  await page.waitForSelector('[data-testid="cd-link-create"]', { timeout: 10000 })
  await page.click('[data-testid="cd-link-create"]')
  await page.waitForFunction((id) => !document.querySelector(`[data-testid="lead-card-${id}"]`),
    { timeout: 25000 }, complete.id)
  const afterQualify = await fingerprint(complete.id)
  if (afterQualify.parent_record_id) created.push(afterQualify.parent_record_id)
  check('Qualify converts: status Qualified, account created and linked',
    afterQualify.status === 'Qualified' && !!afterQualify.parent_record_id
      && afterQualify.accounts === beforeCancel.accounts + 1,
    `${beforeCancel.status} -> ${afterQualify.status}, accounts ${beforeCancel.accounts} -> ${afterQualify.accounts}`)
  check('ONE atomic call, not LinkAccountPanel\'s three',
    calls.length === 1 && calls[0].endsWith('/qualify'),
    `POSTs to /api/contacts/*: ${JSON.stringify(calls)}`)
  check('and the qualified lead LEAVES the pipeline',
    !(await page.$(`[data-testid="lead-card-${complete.id}"]`)),
    'the card is gone from view-leads, which shows Unqualified and Nurture only')
  await page.screenshot({ path: `${OUT}p2-after-qualify.png` })

  // ── THE DOOR, BOTH WAYS, PER CARD ─────────────────────────────────────
  await toLeads()
  const door = await page.evaluate((mine, theirs) => {
    const live = (root, key) => {
      const el = root.querySelector(`[data-testid="${key}"]`)
      if (!el) return 'absent'
      const cs = getComputedStyle(el)
      return (!el.disabled && cs.pointerEvents !== 'none' && el.tabIndex !== -1) ? 'live' : 'dead'
    }
    const read = (id) => {
      const card = document.querySelector(`[data-testid="lead-card-${id}"]`)
      if (!card) return null
      return {
        qualify: live(card, `lead-qualify-${id}`),
        nurture: live(card, `lead-nurture-${id}`),
        followup: live(card, `lead-followup-btn-${id}`),
        address: live(card, `lead-address-${id}`),
        navigable: card.tabIndex === 0,
      }
    }
    return { mine: read(mine), theirs: read(theirs) }
  }, partial.id, theirs.id)
  // THE WRITE ACTIONS ARE THREE, NOT FOUR, AND THAT IS A FINDING RATHER THAN
  // A LOOSENED ASSERTION. Address details is a READ DISCLOSURE: it reveals
  // read-only address fields and writes nothing. The door leaves it alive
  // because P3 exempted disclosure toggles after recording that "the door had
  // made an unowned lead unreadable, which is the one thing it must never
  // do". Killing it here would reintroduce exactly that defect.
  //
  // The Phase 2 instruction lists Address among the neutralised set, so the
  // two disagree, and the disagreement is reported rather than resolved by
  // whichever assertion is easier to make pass.
  const writes = ['qualify', 'nurture', 'followup']
  check('on an UNOWNED card every WRITE action is neutralised',
    !!door.theirs && writes.every((k) => door.theirs[k] === 'dead'),
    JSON.stringify(door.theirs))
  check('Address details stays alive on an unowned card, as a disclosure',
    door.theirs?.address === 'live',
    'P3: the door must never make an unowned lead unreadable')
  check('and the unowned card is still navigable, so the door is not a wall',
    !!door.theirs && door.theirs.navigable === true, `tabIndex 0: ${door.theirs?.navigable}`)
  check('on an OWNED card every write action is alive',
    !!door.mine && [...writes, 'address'].every((k) => door.mine[k] === 'live'),
    JSON.stringify(door.mine))

  // AND WHAT MAKES "ALIVE" SAFE: the panel it reveals contains no control at
  // all. A disclosure that revealed an editor would be a write path wearing a
  // toggle, and the exemption would be the hole.
  await page.click(`[data-testid="lead-address-${theirs.id}"]`)
  await page.waitForSelector(`#lead-address-panel-${theirs.id}`, { timeout: 10000 })
  const inPanel = await page.evaluate((id) => {
    const panel = document.getElementById(`lead-address-panel-${id}`)
    return panel.querySelectorAll('input, select, textarea, button, [tabindex]').length
  }, theirs.id)
  check('the disclosed address panel holds ZERO controls, so alive costs nothing',
    inPanel === 0, `${inPanel} interactive elements inside the revealed panel`)
  await page.screenshot({ path: `${OUT}p2-door.png` })

  // ── THE ADDRESS DISCLOSURE ────────────────────────────────────────────
  await page.click(`[data-testid="lead-address-${partial.id}"]`)
  await page.waitForSelector(`[data-testid="lead-address-${partial.id}"][aria-expanded="true"]`, { timeout: 10000 })
  const cells = await page.$$eval(`#lead-address-panel-${partial.id} .lead-address-cell`, (c) => c.length)
  const oneRow = await page.evaluate((id) => {
    const cs = [...document.querySelectorAll(`#lead-address-panel-${id} .lead-address-cell`)]
    return new Set(cs.map((c) => Math.round(c.getBoundingClientRect().top))).size
  }, partial.id)
  check('Address details discloses all six fields', cells === 6, `${cells} cells in ${oneRow} row(s)`)
  await page.screenshot({ path: `${OUT}p2-address.png` })
} finally {
  for (const id of created) await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  const live = must(await db.from('records').select('id').is('deleted_at', null), 'sweep')
  const revs = must(await db.from('record_revisions').select('payload').in('record_id', live.map((r) => r.id)), 'revs')
  console.log(`\n  soft deleted ${created.length}; live ${TAG} remaining: ${revs.filter((r) => String(r.payload?.name ?? '').startsWith(TAG)).length}`)
  await browser.close()
}
const f = results.filter((r) => !r.pass)
console.log(`\n  ${results.length - f.length}/${results.length} checks pass`)
process.exit(f.length ? 1 : 0)
