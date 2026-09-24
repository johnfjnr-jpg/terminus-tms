// ── PHASE 0: WHAT THE BUTTONS ACTUALLY DO ────────────────────────────────
//
// The lifecycle audit drove ROUTES and found them conforming. John's walk drove
// BUTTONS and found the screen broken. Those are two different populations and
// the audit's green says nothing about this one, so this drives the controls a
// person actually presses, as the record's owner, on a real record.
//
// MEASURE ONLY. Nothing is built until the mechanisms are reported.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('approve-path/probe-p0-click-paths.mjs')
import { readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/approve-path/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = process.env.C_TAG ?? 'apath0'
const log = []
const say = (s) => { console.log(s); log.push(s) }

const DEAL = {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60,
  targetMargin: 30, warrantyPct: 2, installResp: 'Terminus Contractor - Lump Sum',
  lumpSumCost: 200000, whtPct: 15, gstPct: 9, grossUp: true,
}
const BUTTONS = ['btn-save-version', 'btn-issue-version', 'btn-request-pricing-approval', 'btn-open-approval']

const { oppId } = await freshOpportunity(TAG)
await api('PATCH', `/opportunities/${oppId}`, { payload: DEAL })
const ladder = async () => (await admin().from('deal_sheet_versions')
  .select('major, minor, status').eq('record_id', oppId)
  .order('major', { ascending: true }).order('minor', { ascending: true })).data ?? []

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  const errors = []
  const requests = []
  p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 160)}`) })
  p.on('request', (r) => { if (r.url().includes('/api/')) requests.push(`${r.method()} ${r.url().split('/api')[1]}`) })
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  const visibleView = () => p.evaluate(() =>
    [...document.querySelectorAll('[id^="view-"]')].filter((v) => !v.classList.contains('hidden'))
      .map((v) => v.id).join(',') || '(none)')
  const land = async (width) => {
    await p.setViewport({ width, height: 1400 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-detail","${oppId}")`)
    await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 40000 })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)))
    await p.evaluate(() => {
      const el = [...document.querySelectorAll('#view-opportunity-detail .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      el?.click()
    })
    await p.evaluate(() => new Promise((r) => setTimeout(r, 2000)))
  }
  const census = () => p.evaluate((ids) => ids.map((id) => {
    const e = document.getElementById(id)
    if (!e) return { id, state: 'ABSENT' }
    return {
      id,
      label: e.textContent.trim(),
      visible: e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
      disabled: e.disabled === true,
      title: e.getAttribute('title') ?? '',
      // REACT BINDS ITS OWN HANDLERS, so an inline onclick is absent either
      // way. What IS visible from here is whether React attached any props to
      // this fibre at all, which is where an unbound button shows itself.
      reactProps: (() => {
        const k = Object.keys(e).find((x) => x.startsWith('__reactProps$'))
        if (!k) return 'no react fibre'
        return Object.keys(e[k]).filter((n) => n.startsWith('on')).join(',') || 'NO on* PROPS'
      })(),
    }
  }), BUTTONS)

  await land(1440)
  say('\n════ THE FOUR CONTROLS IN THE VERSIONS CARD ════')
  for (const c of await census()) {
    say(`  ${c.id.padEnd(30)} ${c.state ?? ''}${c.state ? '' : `"${c.label}" visible=${c.visible} disabled=${c.disabled}`}`)
    if (!c.state) say(`  ${''.padEnd(30)} react handlers: ${c.reactProps}${c.title ? `   title="${c.title}"` : ''}`)
  }

  // ── THE CLICK THAT JOHN REPORTS DOING NOTHING ─────────────────────────
  say('\n════ CLICKING "Approval view" ════')
  const before = await visibleView()
  requests.length = 0; errors.length = 0
  await p.click('#btn-open-approval')
  await p.evaluate(() => new Promise((r) => setTimeout(r, 2500)))
  const after = await visibleView()
  say(`  visible view before: ${before}`)
  say(`  visible view after : ${after}`)
  say(`  view changed       : ${before !== after}`)
  say(`  /api requests fired: ${requests.length ? requests.join(', ') : 'NONE'}`)
  say(`  errors             : ${errors.length ? errors.join(' | ') : 'none'}`)

  // Does the destination view work when reached directly? That separates "the
  // button is unbound" from "the approval view is broken", which are different
  // findings with different fixes.
  await p.evaluate((src) => { (0, eval)(src) }, `navigate("opportunity-approval","${oppId}")`)
  await p.evaluate(() => new Promise((r) => setTimeout(r, 2500)))
  const direct = await visibleView()
  const approvalBody = await p.evaluate(() => {
    const v = document.querySelector('#view-opportunity-approval')
    return { text: (v?.innerText ?? '').trim().slice(0, 120), children: v?.children.length ?? 0 }
  })
  say(`  reached DIRECTLY by navigate(): view=${direct}, ${approvalBody.children} children`)
  say(`  the approval view renders: "${approvalBody.text.replace(/\n/g, ' | ')}"`)

  // ── THE FULL JOURNEY ──────────────────────────────────────────────────
  say('\n════ THE SCREEN JOURNEY: draft -> Save version -> issue -> promotion ════')
  await land(1440)
  say(`  ladder at the start: ${(await ladder()).map((v) => `${v.major}.${v.minor}/${v.status}`).join(' ') || 'empty'}`)

  await p.click('#deal-version-reason')
  await p.keyboard.type('first pricing for the walk')
  await p.evaluate(() => new Promise((r) => setTimeout(r, 200)))
  await p.click('#btn-save-version')
  await p.waitForFunction(() => {
    const f = document.getElementById('deal-version-feedback')
    return f && !f.classList.contains('hidden') && f.textContent.trim()
  }, { timeout: 30000 }).catch(() => {})
  await p.evaluate(() => new Promise((r) => setTimeout(r, 1500)))
  const savedFeedback = await p.evaluate(() =>
    (document.getElementById('deal-version-feedback')?.textContent ?? '').trim())
  say(`  after Save version: feedback "${savedFeedback}"`)
  say(`  ladder now: ${(await ladder()).map((v) => `${v.major}.${v.minor}/${v.status}`).join(' ')}`)
  const labels = () => p.evaluate(() => [...document.querySelectorAll('#deal-version-list .ds-label')]
    .map((e) => e.textContent.trim().split('\n')[0].trim()))
  say(`  the panel shows: ${(await labels()).join(', ')}`)

  const issueState = (await census()).find((c) => c.id === 'btn-issue-version')
  say(`\n  the issue control: ${issueState.state ?? `"${issueState.label}" visible=${issueState.visible} `
    + `disabled=${issueState.disabled} title="${issueState.title}"`}`)

  if (!issueState.state && issueState.visible && !issueState.disabled) {
    requests.length = 0; errors.length = 0
    await p.click('#btn-issue-version')
    await p.evaluate(() => new Promise((r) => setTimeout(r, 3000)))
    say(`  clicked it: /api ${requests.join(', ') || 'NONE'}`)
    say(`  ladder now: ${(await ladder()).map((v) => `${v.major}.${v.minor}/${v.status}`).join(' ')}`)
    say(`  the panel shows: ${(await labels()).join(', ')}`)
    say(`  errors: ${errors.length ? errors.join(' | ') : 'none'}`)
  } else {
    say(`  NOT CLICKABLE, so the screen journey stops here.`)
  }

  await p.evaluate(() => document.querySelector('#deal-version-panel')?.scrollIntoView({ block: 'center' }))
  await p.evaluate(() => new Promise((r) => setTimeout(r, 400)))
  await p.screenshot({ path: `${OUT}p0-versions-1440.png` })
  say(`  captured p0-versions-1440.png ${statSync(`${OUT}p0-versions-1440.png`).size} bytes`)
} finally {
  await b.close()
  await tearDown(TAG)
}
writeFileSync(`${OUT}p0.txt`, log.join('\n'))
say('\nfixtures torn down')
