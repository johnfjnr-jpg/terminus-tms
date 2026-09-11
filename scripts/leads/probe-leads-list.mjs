// P4: the Leads list, verified on the live screen.
//
// TWO CARDS IS THE INSTRUMENT, and this list is the reason it has to be said
// plainly: measured before building, ALL ELEVEN live contacts belong to other
// accounts, so a probe that just loaded the page would have found every card
// neutralised and called the door proven. It would have been reading a screen
// with no owned card on it.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-leads-list.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { enumerateControlsInPage, classifyControl } from '../lib/enumerate-controls.mjs'
import { admin, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const TAG = 'p4list'
const OUT = `${ROOT}/.verify/leads/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const call = async (m, p, b) => (await api(m, p, b)).data
const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}`)
  if (detail) console.log(`        ${detail}`)
}

try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('  bundle freshness FAILED - refusing to measure a stale bundle'); process.exit(2)
}

const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
const OTHER = users.users.find((u) => u.email === 'ownership-other@terminus-probe.invalid')?.id
if (!OTHER) throw new Error('the probe account does not exist; refusing to guess an owner id')

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const industry = (await call('GET', '/industries'))[0]
  const make = async (label) => (await call('POST', '/contacts', {
    name: `${TAG}-${label} Lead`, company: 'List Holdings', email: `${TAG}@example.invalid`,
    mobile: '+65 9000 0012', source: 'Direct Outreach', industry_id: industry.id,
  }))
  const mine = await make('own')
  const theirs = await make('other')
  // NOTES ON BOTH, and the unowned one is the reason this is not just setup.
  //
  // A first run gave notes only to the owned card and asserted that the
  // unowned card's expand control stays alive. It read "0 live" and failed -
  // correctly, but for the wrong reason: the unowned card had no notes, so
  // there was no expand control to keep alive. That is a claim true by
  // ABSENCE, which Verification 14 names, and it would have passed the moment
  // somebody "fixed" it by loosening the assertion.
  //
  // Both cards get five notes. The claim is then real: on a lead you may not
  // edit, you must still be able to EXPAND the notes and read them - the
  // disclosure lesson P3 paid for.
  const noted = (id) => call('PATCH', `/contacts/${id}`, { payload: {
    summary: 'A lead for the list probe.',
    notes: Array.from({ length: 5 }, (_, i) => ({
      text: `note ${i}`, at: new Date(Date.now() - i * 60000).toISOString(), by: 'probe@example.invalid' })) } })
  await noted(mine.id)
  // BEFORE THE HANDOVER, and the ordering is not incidental: patching after it
  // is refused 403 by the very ownership guard this probe exists to measure.
  // The first run did exactly that and the probe died on its own fixture.
  await noted(theirs.id)
  must(await db.from('records').update({ owner_id: OTHER }).eq('id', theirs.id).select('id'), 'hand over')

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1200 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate(() => navigate('leads'))
  await page.waitForFunction((a, b) => {
    const c = document.getElementById('live-leads-rows')
    return !!c?.querySelector(`[data-testid="lead-card-${a}"]`)
      && !!c?.querySelector(`[data-testid="lead-card-${b}"]`)
  }, { polling: 200, timeout: 30000 }, mine.id, theirs.id)

  await page.evaluate((e, c) => {
    window.__enum = new Function('return ' + e)()
    window.__classify = new Function('return ' + c)()
  }, enumerateControlsInPage.toString(), classifyControl.toString())

  // ── LAYOUT ──────────────────────────────────────────────────────────
  const L = await page.evaluate((mineId) => {
    const q = (t) => document.querySelector(`[data-testid="${t}"]`)
    const card = q(`lead-card-${mineId}`)
    const cs = (el, p) => (el ? getComputedStyle(el)[p] : null)
    const cols = card ? [...card.querySelectorAll('.lead-card-col')] : []
    return {
      groups: [...document.querySelectorAll('[data-testid^="lead-group-title-"]')].map((e) => e.textContent.trim()),
      nameSize: cs(q(`lead-name-${mineId}`), 'fontSize'),
      nameColour: cs(q(`lead-name-${mineId}`), 'color'),
      sub: q(`lead-sub-${mineId}`)?.textContent ?? null,
      badge: q(`lead-status-${mineId}`)?.textContent ?? null,
      // THREE COLUMNS SHARE ONE ROW, asserted by equal tops rather than counted:
      // a count of three cannot see a wrap, which is the Test Bed lesson.
      colTops: cols.map((e) => Math.round(e.getBoundingClientRect().top)),
      colCount: cols.length,
      hasSummary: !!q(`lead-summary-${mineId}`),
      hasNotes: !!q(`lead-notes-${mineId}`),
      hasFollowUp: !!q(`lead-followup-${mineId}`),
      // NO stage or save controls on the card.
      forbidden: ['cd-btn-qualify', 'cd-btn-park', 'cd-btn-unqualify', 'cd-btn-delete', 'save-all', 'discard-all']
        .filter((t) => !!card?.querySelector(`[data-testid="${t}"]`)),
      notesShown: card?.querySelector('[data-testid="cd-notes-shown"]')?.textContent ?? null,
      noteRows: card ? card.querySelectorAll('[data-testid^="cd-note-"]').length : 0,
    }
  }, mine.id)

  check('grouped by status', L.groups.length > 0 && L.groups.some((g) => /Unqualified/.test(g)),
    JSON.stringify(L.groups))
  check('the lead name is 14px and green',
    L.nameSize === '14px' && /(102,\s*204,\s*153)/.test(L.nameColour ?? ''),
    `${L.nameSize} ${L.nameColour}`)
  check('company, source and created date sit beneath the name',
    !!L.sub && L.sub.split('·').length === 3, JSON.stringify(L.sub))
  check('the status badge is on the card', !!L.badge, JSON.stringify(L.badge))
  check('Summary, Notes and Follow-up are three columns SHARING ONE ROW',
    L.colCount === 3 && new Set(L.colTops).size === 1,
    `${L.colCount} columns, tops ${JSON.stringify(L.colTops)}`)
  check('no Qualify / Nurture / Save / Discard / Delete / Unqualify on the card',
    L.forbidden.length === 0, L.forbidden.join(', ') || 'none present')
  check('notes default to the latest 2', L.noteRows === 2 && /Showing 2 of 5/.test(L.notesShown ?? ''),
    `${L.noteRows} rendered, "${L.notesShown}"`)

  // ── THE DOOR, PER CARD, BOTH WAYS ───────────────────────────────────
  const D = await page.evaluate((mineId, theirsId) => {
    const named = (card) => ({
      addNote: [...card.querySelectorAll('[data-testid="cd-add-note-btn"]')],
      followUpDate: [...card.querySelectorAll('[data-testid="cd-followUpDate"]')],
      followUpDescription: [...card.querySelectorAll('[data-testid="cd-followUpDescription"]')],
      followUpSave: [...card.querySelectorAll('[data-testid="cd-followup-save"]')],
    })
    const live = (el) => {
      const cs = getComputedStyle(el)
      return !el.disabled && cs.pointerEvents !== 'none'
    }
    const read = (id) => {
      const card = document.querySelector(`[data-testid="lead-card-${id}"]`)
      const n = named(card)
      const out = { notMine: card.getAttribute('data-not-mine'), cardTabIndex: card.tabIndex }
      for (const [k, els] of Object.entries(n)) {
        out[k] = { present: els.length, live: els.filter(live).length }
      }
      // The card itself must stay navigable, and any disclosure inside it alive.
      const all = window.__enum ? [] : []
      const expand = [...card.querySelectorAll('[data-testid^="cd-notes-show-"]')]
      out.expandTotal = expand.length
      // `Latest 2` is disabled at rest because it is the CURRENT rung, which is
      // the component saying so rather than the door. Liveness is measured on
      // the rungs that are not current.
      out.expandControls = expand.filter((e) => live(e)).length
      return out
    }
    return { mine: read(mineId), theirs: read(theirsId) }
  }, mine.id, theirs.id)

  console.log('\n  THE DOOR ON A CARD, per named inline write')
  console.log('  control                mine                 not mine')
  for (const k of ['addNote', 'followUpDate', 'followUpDescription', 'followUpSave']) {
    const m = D.mine[k], t = D.theirs[k]
    console.log(`  ${k.padEnd(22)} ${m.present} present, ${m.live} live   ${t.present} present, ${t.live} live`)
  }

  for (const k of ['addNote', 'followUpDate', 'followUpDescription']) {
    check(`${k}: neutralised on an unowned card, alive on your own`,
      D.theirs[k].present > 0 && D.theirs[k].live === 0 && D.mine[k].live > 0,
      `mine ${JSON.stringify(D.mine[k])}, theirs ${JSON.stringify(D.theirs[k])}`)
  }
  check('the unowned card is still NAVIGABLE (its own tab stop survives)',
    D.theirs.cardTabIndex === 0, `tabIndex ${D.theirs.cardTabIndex}`)
  // The disclosure half, and it asserts the control EXISTS first - otherwise
  // "0 live" is satisfied by a card that simply has no notes.
  check('the notes EXPAND control EXISTS and stays alive on an unowned card',
    D.theirs.expandTotal > 0 && D.theirs.expandControls > 0,
    `${D.theirs.expandControls} live of ${D.theirs.expandTotal} present`)
  check('the card carries data-not-mine correctly both ways',
    D.mine.notMine === 'false' && D.theirs.notMine === 'true',
    `mine=${D.mine.notMine} theirs=${D.theirs.notMine}`)

  // ── NAVIGATION: the card opens, the inline region does not ──────────
  await page.evaluate((id) => document.querySelector(`[data-testid="lead-notes-${id}"]`)?.click(), mine.id)
  await new Promise((r) => setTimeout(r, 400))
  const stayed = await page.evaluate(() => !document.getElementById('view-contact-detail')
    || document.getElementById('view-contact-detail').classList.contains('hidden'))
  check('clicking the NOTES region does not navigate', stayed, `still on the list: ${stayed}`)

  await page.evaluate((id) => document.querySelector(`[data-testid="lead-summary-${id}"]`)?.click(), mine.id)
  const navigated = await page.waitForFunction(() => {
    const v = document.getElementById('view-contact-detail')
    return !!v && !v.classList.contains('hidden') && !!v.querySelector('[data-testid="cd-lead-name"]')
  }, { polling: 150, timeout: 10000 }).then(() => true).catch(() => false)
  check('clicking the card elsewhere OPENS the lead', navigated, `navigated: ${navigated}`)

  await page.evaluate(() => navigate('leads'))
  await page.waitForFunction((a) => !!document.querySelector(`[data-testid="lead-card-${a}"]`),
    { polling: 200, timeout: 20000 }, mine.id)
  await page.screenshot({ path: `${OUT}p4-leads-list.png`, fullPage: true })
  console.log(`\n  screenshot ${OUT}p4-leads-list.png`)
  await page.close()
} finally {
  await browser.close()
  const swept = await tearDown(TAG)
  console.log(`  teardown: ${swept.removed.length} swept, ${swept.remaining} remaining`)
}
const failed = results.filter((r) => !r.pass)
console.log(`\n  ${results.length - failed.length}/${results.length} verified on the live screen`)
process.exit(failed.length ? 1 : 0)
