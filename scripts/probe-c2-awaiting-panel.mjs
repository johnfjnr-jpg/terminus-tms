// ── C2: A PROMOTED, UNSIGNED MAJOR READS "AWAITING APPROVAL" ON SCREEN ───
//
// G2 proved the DERIVATION and the headline: `issued_major` is set by
// promotion, and the Approved Version field reads None for a major nobody has
// signed. It did NOT prove what the Approvals panel says, which is a different
// surface and is where R-L4's middle state has to be legible.
//
// So this drives it: raise a real pricing approval against a promoted version,
// decide nothing, and read the panel.
//
// AND IT ASSERTS THE ABSENCE TOO. "Awaiting approval" appearing somewhere is
// satisfied by a panel that says it always; the Approved Version field must
// still read None at the same moment, on the same record, in the same load.
//
// UNWIRED: needs a browser, a live server and a session.
import { loadPuppeteer } from './lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-c2-awaiting-panel.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { api } from './api-client.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'

const ROOT = process.cwd()
const OUT = `${ROOT}/.verify/label-convergence/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'C2AWAIT'
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}

const { oppId } = await freshOpportunity(TAG)
const rev = async () => (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
const LIVE = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates

// A pricing approval is collected from PROPOSAL onward, so the record has to be
// there for the version-scoped tracks to exist at all.
await admin().from('records').update({ status: 'Proposal' }).eq('id', oppId)

const draft = (await api('POST', `/opportunities/${oppId}/deal-sheet-versions`, {
  inputs: { targetMargin: 30 }, rates: frozenRates(resolveRates({ targetMargin: 30 }, LIVE)),
  reason: 'the draft', expected_revision: await rev(),
})).data
const promoted = (await api('POST', `/deal-sheet-versions/${draft.id}/issue`, {})).data
check(promoted.status === 'issued', 'a major is promoted', `V${promoted.major}.${promoted.minor}`)

const raised = await api('POST', `/records/${oppId}/transition-requests`, {
  to_stage: 'Evaluation', kind: 'review', version_id: promoted.id,
}, { expect: 201, because: 'a pricing approval is raised against the promoted version' })
check(raised?.status === 201, 'a pricing approval is raised against it, and NOTHING is decided',
  `status ${raised?.status}`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  for (const width of [1920, 1240]) {
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
    }, { timeout: 25000 })
    await p.waitForFunction(() => {
      const el = document.getElementById('opp-review-banner')
      return el && el.textContent.trim().length > 0
    }, { timeout: 25000 })
    await p.evaluate(() => document.fonts.ready)

    console.log(`\n=== ${width}px ===`)
    const m = await p.evaluate(() => {
      const t = (el) => (el?.textContent ?? '').trim()
      const banner = document.getElementById('opp-review-banner')
      const cells = [...document.querySelectorAll('.ohl-figure')]
      const figure = (label) => {
        const c = cells.find((e) => t(e.querySelector('.ohl-label')) === label)
        return c ? t(c.querySelector('.ohl-value')) : null
      }
      return {
        banner: t(banner),
        trackStates: [...banner.querySelectorAll('.sa-decision-row')].map((r) => ({
          track: t(r.querySelector('.sa-track')), state: t(r.querySelector('.sa-approval-meta')),
        })),
        approvedField: figure('Approved version'),
      }
    })

    check(m.trackStates.length > 0, `the Approvals panel lists its tracks at ${width}`,
      m.trackStates.map((r) => `${r.track}=${r.state}`).join(', '))
    check(m.trackStates.every((r) => /awaiting approval/i.test(r.state)),
      `every undecided track reads "Awaiting approval" at ${width}`,
      m.trackStates.map((r) => r.state).join(' | '))
    check(!/\bfor issue\b/i.test(m.banner),
      `and the banner no longer says "for issue" at ${width}`)
    // THE PAIR, IN ONE LOAD: awaiting here, None there.
    check(m.approvedField === 'None',
      `while the Approved version field reads None at ${width}`, `"${m.approvedField}"`)

    await p.evaluate(() => document.getElementById('opp-review-banner')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const inView = await p.evaluate(() => {
      const r = document.getElementById('opp-review-banner')?.getBoundingClientRect()
      return r ? r.top < window.innerHeight && r.bottom > 0 : false
    })
    check(inView, `the Approvals panel is inside the captured region at ${width}`)
    await p.screenshot({ path: `${OUT}awaiting-${width}.png` })
  }
} finally {
  await b.close()
  await tearDown(TAG)
}

const pass = checks.filter(Boolean).length
console.log(`\n${pass}/${checks.length} C2 checks passed`)
process.exitCode = pass === checks.length ? 0 : 1
