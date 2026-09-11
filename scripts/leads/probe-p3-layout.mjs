// P3: the Lead Detail redesign, verified on the live screen.
//
// Every claim here is a LIVE DOM read after a rebuild. The vanilla-asserting
// suites are not evidence about this screen, and the served bundle is a second
// reader of the source - so this refuses to run on a stale one.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p3-layout.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const TAG = 'p3lay'
const OUT = `${ROOT}/.verify/leads/`
mkdirSync(OUT, { recursive: true })
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const call = async (m, p, b) => (await api(m, p, b)).data
const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}`)
  if (detail) console.log(`        ${detail}`)
}

try {
  execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' })
} catch {
  console.error('  bundle freshness FAILED - refusing to measure a stale bundle')
  process.exit(2)
}

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const industry = (await call('GET', '/industries'))[0]
  const lead = await call('POST', '/contacts', {
    name: `${TAG} Lead`, company: 'Layout Holdings', email: `${TAG}@example.invalid`,
    mobile: '+65 9000 0008', source: 'Direct Outreach', industry_id: industry.id,
  })
  // Notes enough to exercise the fold.
  const now = Date.now()
  await call('PATCH', `/contacts/${lead.id}`, {
    payload: {
      notes: Array.from({ length: 6 }, (_, i) => ({
        text: `note ${i}`, at: new Date(now - i * 60000).toISOString(), by: 'probe@example.invalid',
      })),
    },
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1000 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate((id) => navigate('contact-detail', id), lead.id)
  await page.waitForFunction(() => {
    const v = document.getElementById('view-contact-detail')
    return !!v && !v.classList.contains('is-loading') && !!v.querySelector('[data-testid="cd-lead-name"]')
  }, { polling: 150, timeout: 30000 })
  // The Qualify hint arrives from a second request; wait on it rather than a delay.
  await page.waitForFunction(() => !!document.getElementById('view-contact-detail')
    ?.querySelector('[data-testid="cd-qualify-hint"]'),
    { polling: 150, timeout: 15000 }).catch(() => {})

  const L = await page.evaluate(() => {
    // SCOPED TO THE VIEW, and P4 is why.
    //
    // These were document-wide and passed for three phases, because the only
    // thing rendering NotesHistory was this screen. P4's Leads list renders the
    // SAME component into #live-leads-rows, its React root stays mounted when
    // you navigate away, and a hidden card's notes answered these queries
    // first: 22 note rows counted where the record has 6, and `cd-notes` found
    // at top 0 because the match was an off-screen card.
    //
    // It read as a P3 regression and was a probe measuring the wrong surface.
    // Two screens sharing a component share its testids, which is correct -
    // the probe is what has to say which screen it means.
    const view = document.getElementById('view-contact-detail')
    const q = (t) => view.querySelector(`[data-testid="${t}"]`)
    const top = (t) => { const e = q(t); return e ? Math.round(e.getBoundingClientRect().top) : null }
    const cs = (t, p) => { const e = q(t); return e ? getComputedStyle(e)[p] : null }
    return {
      order: {
        back: top('cd-back'), title: top('cd-title'), headerRow: top('cd-header-row'),
        summary: top('cd-card-summary'), notes: top('cd-notes'),
        cards: top('cd-cards'), account: top('cd-card-account'), followUp: top('cd-card-followup'),
      },
      leadName: { text: q('cd-lead-name')?.textContent ?? null, size: cs('cd-lead-name', 'fontSize') },
      titleColour: cs('cd-title', 'color'),
      summaryHeader: cs('cd-card-summary', 'fontSize'),
      // 6: side by side means EQUAL TOPS, which is the lesson from the Test Bed
      // strip - a count of two cards cannot see a wrap.
      sideBySide: (() => {
        const c = q('cd-card-contact'), a = q('cd-card-address')
        if (!c || !a) return null
        return { contactTop: Math.round(c.getBoundingClientRect().top),
          addressTop: Math.round(a.getBoundingClientRect().top) }
      })(),
      collapsed: {
        contact: q('cd-card-contact-body')?.hasAttribute('hidden') ?? null,
        address: q('cd-card-address-body')?.hasAttribute('hidden') ?? null,
      },
      perFieldDiscard: view.querySelectorAll('[data-testid^="discard-"]:not([data-testid="discard-all"])').length,
      qualify: { present: !!q('cd-btn-qualify'), disabled: q('cd-btn-qualify')?.disabled ?? null },
      hint: q('cd-qualify-hint')?.textContent ?? null,
      nurtureLabel: q('cd-btn-park')?.textContent ?? null,
      dirtyHidden: q('cd-dirty-indicator')?.hasAttribute('hidden') ?? null,
      notesShown: q('cd-notes-shown')?.textContent ?? null,
      // `cd-note-` is also a prefix of `cd-notes-*`, so this is anchored on the
      // row testid pattern rather than a loose prefix.
      noteCount: view.querySelectorAll('[data-testid^="cd-note-"]:not([data-testid^="cd-notes-"])').length,
      followUpControls: ['cd-followUpDate', 'cd-followUpDescription', 'cd-followup-save']
        .filter((t) => !!q(t)).length,
    }
  })

  const o = L.order
  const seq = ['back', 'title', 'headerRow', 'summary', 'notes', 'cards', 'account', 'followUp']
  const tops = seq.map((k) => o[k])
  check('the ruled order, top to bottom', tops.every((t, i) => t !== null && (i === 0 || t >= tops[i - 1])),
    seq.map((k, i) => `${k}=${tops[i]}`).join(' '))
  check('the lead name is 18px', L.leadName.size === '18px', `${JSON.stringify(L.leadName)}`)
  check('the title is green', /(102,\s*204,\s*153)/.test(L.titleColour ?? ''), `${L.titleColour}`)
  check('Contact Details and Address are SIDE BY SIDE (equal tops)',
    !!L.sideBySide && L.sideBySide.contactTop === L.sideBySide.addressTop, JSON.stringify(L.sideBySide))
  check('both are COLLAPSED by default',
    L.collapsed.contact === true && L.collapsed.address === true, JSON.stringify(L.collapsed))
  check('NO per-field discard anywhere on the screen', L.perFieldDiscard === 0,
    `${L.perFieldDiscard} found`)
  check('Qualify is present and DISABLED on an incomplete lead',
    L.qualify.present && L.qualify.disabled === true, JSON.stringify(L.qualify))
  check('the hint NAMES what is missing', !!L.hint && /needs \d+ more/.test(L.hint),
    JSON.stringify(L.hint))
  check('the Nurture control is labelled Nurture', L.nurtureLabel === 'Nurture', JSON.stringify(L.nurtureLabel))
  check('the dirty indicator is hidden when nothing is unsaved', L.dirtyHidden === true, `${L.dirtyHidden}`)
  check('notes default to the latest 2 of 6', L.noteCount === 2 && /Showing 2 of 6/.test(L.notesShown ?? ''),
    `${L.noteCount} rendered, "${L.notesShown}"`)
  check('the follow-up task renders date, description and save', L.followUpControls === 3,
    `${L.followUpControls}/3`)

  // The dirty indicator, exercised rather than assumed.
  const inView = (t) => `document.getElementById('view-contact-detail').querySelector('[data-testid="${t}"]')`
  await page.evaluate(`${inView('cd-card-contact-toggle')}?.click()`)
  await page.waitForFunction(() => {
    const b = document.getElementById('view-contact-detail')
      .querySelector('[data-testid="cd-card-contact-body"]')
    return b && !b.hasAttribute('hidden')
  }, { polling: 50, timeout: 5000 })
  await page.evaluate(`${inView('display-company')}?.click()`)
  await page.waitForFunction(() => {
    const e = document.getElementById('view-contact-detail')
      .querySelector('[data-testid="edit-company"]')
    return e && !e.hasAttribute('hidden')
  }, { polling: 50, timeout: 5000 })
  await page.type('[data-testid="input-company"] input, [data-testid="input-company"]', 'X')
  await new Promise((r) => setTimeout(r, 300))
  const dirty = await page.evaluate(() => {
    const d = document.getElementById('view-contact-detail')
      .querySelector('[data-testid="cd-dirty-indicator"]')
    return { hidden: d?.hasAttribute('hidden') ?? null, text: d?.textContent ?? null }
  })
  check('the dirty indicator APPEARS and counts, on an edit',
    dirty.hidden === false && /unsaved change/.test(dirty.text ?? ''), JSON.stringify(dirty))

  await page.screenshot({ path: `${OUT}p3-lead-detail.png`, fullPage: true })
  console.log(`\n  screenshot ${OUT}p3-lead-detail.png`)
  await page.close()
} finally {
  await browser.close()
  const swept = await tearDown(TAG)
  console.log(`  teardown: ${swept.removed.length} swept, ${swept.remaining} remaining`)
}
const failed = results.filter((r) => !r.pass)
console.log(`\n  ${results.length - failed.length}/${results.length} verified on the live screen`)
process.exit(failed.length ? 1 : 0)
