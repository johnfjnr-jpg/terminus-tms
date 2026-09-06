// ── THE WRITE PATH, UNDER WHICHEVER PAIR IS LIVE ────────────────────────
//
// Used by the revert rehearsal. It touches only ids BOTH cards render and
// BOTH forms provide, so the same probe answers for all four configurations,
// and it reports which pair it actually ran against rather than assuming.
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 140) })
const puppeteer = await loadPuppeteer('works-under')
let browser = null
const { oppId } = await freshOpportunity('R4WORKS')
{
  const db = admin()
  const { error } = await db.from('records').update({ status: 'Proposal' }).eq('id', oppId)
  if (error) throw new Error('could not stage: ' + error.message)
}
try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  page.on('response', (r) => { if (r.status() >= 500) errs.push('HTTP ' + r.status() + ' ' + r.url()) })
  await page.setViewport({ width: 1440, height: 950 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => typeof window.initOpportunityDealPanel === 'function', { timeout: 25000 })
  await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  // Waits on RENDERED TEXT, because the hidden vanilla markup satisfies any
  // id-presence wait under the swapped configuration.
  await page.waitForFunction(() => {
    const p = [...document.querySelectorAll('#deal-version-panel')]
      .find((e) => e.offsetParent !== null)
    return p && (p.innerText ?? '').trim().length > 20
  }, { timeout: 30000 })

  const which = await page.evaluate(() => ({
    card: document.querySelector('#deal-version-root #deal-version-panel') ? 'REACT' : 'VANILLA',
    form: (document.getElementById('deal-form-root')?.children.length ?? 0) > 0 ? 'REACT' : 'VANILLA',
  }))
  console.log(`  running against: card=${which.card}  form=${which.form}`)

  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))
  // The VISIBLE instance of a shared id, because both cards are in the DOM.
  const vis = (id) => `[...document.querySelectorAll('#${id}')].find((e) => e.offsetParent !== null)`
  const retype = async (id, text) => {
    const h = await page.evaluateHandle(new Function(`return ${vis(id)}`))
    await h.asElement().click()
    await page.evaluate((e) => e.setSelectionRange(0, e.value.length), h)
    await page.keyboard.press('Backspace')
    await settle()
    await page.keyboard.type(text, { delay: 5 })
    await settle()
  }
  const clickVis = async (id) => {
    await page.evaluate(new Function(`${vis(id)}?.click()`))
    await settle()
  }
  const versions = async () => (await api('GET', `/opportunities/${oppId}/deal-sheet-versions`)).data ?? []

  check('the version panel is on screen', true, `card=${which.card} form=${which.form}`)

  // A BLANK REASON REFUSES.
  await clickVis('btn-save-version')
  await settle()
  check('a blank reason refuses and writes nothing', (await versions()).length === 0)

  // A VERSION IS TAKEN, from a dirty form, so the freeze has to save first.
  await retype('deal-ssExisting', '44')
  check('the form reports itself dirty',
    await page.evaluate(() => window.dealFormSeam?.hasUnsavedChanges?.() === true))
  await retype('deal-version-reason', 'the revert rehearsal took this one')
  await clickVis('btn-save-version')
  let took = false
  for (let i = 0; i < 40; i++) {
    if ((await versions()).length >= 1) { took = true; break }
    await new Promise((r) => setTimeout(r, 500))
  }
  check('A VERSION WAS TAKEN', took, await page.evaluate(new Function(`return ${vis('deal-version-feedback')}?.textContent`)))
  const v = (await versions())[0]
  check('and THE FREEZE SAVED FIRST: the version holds the edited value',
    Number(v?.inputs?.ssExisting) === 44, v?.inputs?.ssExisting)

  // RESTORE, which is the seam running the other way.
  await retype('deal-ssExisting', '91')
  await page.evaluate((id) => document.querySelector(`[data-restore-version="${id}"]`)?.click(), v.id)
  await page.waitForFunction(() =>
    !document.getElementById('discard-confirm-modal')?.classList.contains('hidden'), { timeout: 20000 })
  check('a dirty restore asks before discarding', true)
  await page.evaluate(() => document.getElementById('discard-confirm-discard')?.click())
  await page.waitForFunction(() => document.getElementById('deal-ssExisting')?.value === '44',
    { timeout: 20000 }).catch(() => {})
  check('AND THE FORM WAS REPOPULATED through the seam',
    await page.evaluate(() => document.getElementById('deal-ssExisting')?.value === '44'),
    await page.evaluate(() => document.getElementById('deal-ssExisting')?.value))

  check('the outward feeds are published',
    await page.evaluate(() => typeof window.oppRefreshVersionActions === 'function'
      && typeof window.oppCurrentVersionRejection === 'function'))
  check('no page errors or 5xx', errs.length === 0, errs.slice(0, 2).join(' | '))
} catch (err) {
  R.push({ n: 'THREW: ' + String(err.message).slice(0, 130), p: false, d: '' })
} finally {
  try { await browser?.close() } catch {}
  await tearDown()
}
const failed = R.filter((r) => !r.p)
console.log(`  WORKS UNDER: ${R.length - failed.length}/${R.length}`)
for (const r of failed) console.log(`    FAIL ${r.n}  | ${r.d}`)
process.exit(failed.length ? 1 : 0)
