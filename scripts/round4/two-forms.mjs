// ── ROUND 4 PHASE 2 ITEM 4: THE TWO-FORMS GUARANTEE ─────────────────────
// The REACT CARD against the VANILLA FORM's seam. The card must never reach
// around the interface into the React form, and this is what measures it.
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 160) })
const puppeteer = await loadPuppeteer('two-forms')
let browser = null
const { oppId } = await freshOpportunity('R4TWOF')
{
  const db = admin()
  const { error } = await db.from('records').update({ status: 'Proposal' }).eq('id', oppId)
  if (error) throw new Error('could not stage the fixture: ' + error.message)
}

try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text() + ' @' + (m.location()?.url ?? '?')) })
  page.on('requestfailed', (r) => errs.push('REQFAIL ' + r.url()))
  page.on('response', (r) => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url()) })
  await page.setViewport({ width: 1440, height: 950 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => typeof window.initOpportunityDealPanel === 'function', { timeout: 25000 })

  // WHICH FORM IS LIVE, measured rather than assumed.
  const live = await page.evaluate(() => ({
    vanillaFormTag: !!document.querySelector('script[src="/opportunity-deal.js"]'),
    vanillaCardTag: !!document.querySelector('script[src="/opportunity-deal-versions.js"]'),
  }))
  check('THE VANILLA FORM TAG IS RESTORED on this branch', live.vanillaFormTag)
  check('and the vanilla CARD tag stays out, or this measures nothing',
    live.vanillaCardTag === false)

  await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  await page.waitForFunction(() => {
    const root = document.getElementById('deal-version-root')
    return root && root.querySelector('#deal-version-panel')
      && (root.innerText ?? '').trim().length > 20
  }, { timeout: 30000 })

  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))
  const type = async (id, v) => { await page.evaluate(([i, x]) => {
    const e = document.getElementById(i); if (!e) throw new Error('no #' + i)
    const proto = e.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, String(x))
    e.dispatchEvent(new Event('input', { bubbles: true }))
  }, [id, v]); await settle() }
  const click = async (sel) => { await page.evaluate((s) => document.querySelector(s)?.click(), sel); await settle() }
  const versions = async () => (await api('GET', `/opportunities/${oppId}/deal-sheet-versions`)).data ?? []
  const waitVersions = async (n) => {
    for (let i = 0; i < 40; i++) { if ((await versions()).length >= n) return true
      await new Promise((r) => setTimeout(r, 500)) }
    return false
  }

  check('THE REACT CARD MOUNTED over the vanilla form',
    await page.evaluate(() => !!document.querySelector('#deal-version-root #deal-version-panel')))
  check('the FORM on screen is the vanilla one, not React',
    await page.evaluate(() => !document.getElementById('deal-form-vanilla')?.classList.contains('hidden')
      && (document.getElementById('deal-form-root')?.children.length ?? 0) === 0))
  // The card is handed a seam; it must be the VANILLA form's.
  const seamKeys = await page.evaluate(() => Object.keys(window.dealFormSeam ?? {}).sort())
  check('and it is the vanilla form that published the seam',
    seamKeys.length > 0, seamKeys.join(','))

  // ── THE CARD'S OWN WRITE PATH, against that adapter ────────────────────
  await click('#btn-save-version')
  check('the card refuses a blank reason under the vanilla form',
    (await page.evaluate(() => document.getElementById('deal-version-feedback')?.textContent ?? ''))
      .includes('based on'))
  await type('deal-ssExisting', '27')
  check('the vanilla form reports itself dirty through the seam',
    await page.evaluate(() => window.dealFormSeam.hasUnsavedChanges()))
  await type('deal-version-reason', 'taken against the vanilla adapter')
  await click('#btn-save-version')
  check('A VERSION WAS TAKEN through the vanilla seam', await waitVersions(1),
    await page.evaluate(() => document.getElementById('deal-version-feedback')?.textContent))
  const v = (await versions())[0]
  check('and THE FREEZE SAVED FIRST: the version holds the edited value',
    Number(v?.inputs?.ssExisting) === 27, v?.inputs?.ssExisting)

  // ── RESTORE, which is the seam running the other way ───────────────────
  await type('deal-ssExisting', '88')
  await page.evaluate((id) => document.querySelector(`[data-restore-version="${id}"]`)?.click(), v.id)
  await page.waitForFunction(() =>
    !document.getElementById('discard-confirm-modal')?.classList.contains('hidden'), { timeout: 20000 })
  check('THE DISCARD PROMPT APPEARED, so the card asked the vanilla form first', true)
  await click('#discard-confirm-discard')
  await page.waitForFunction(() => document.getElementById('deal-ssExisting')?.value === '27', { timeout: 20000 })
  check('AND THE VANILLA FORM WAS REPOPULATED through the seam',
    await page.evaluate(() => document.getElementById('deal-ssExisting')?.value === '27'))

  // ── THE OUTWARD FEEDS ──────────────────────────────────────────────────
  check('the card still publishes oppRefreshVersionActions',
    await page.evaluate(() => typeof window.oppRefreshVersionActions === 'function'))
  check('and oppCurrentVersionRejection',
    await page.evaluate(() => typeof window.oppCurrentVersionRejection === 'function'))

  check('no page errors under the vanilla form',
    errs.filter((e) => !e.includes('favicon')).length === 0,
    errs.filter((e) => !e.includes('favicon')).slice(0, 2).join(' | '))
} catch (err) {
  R.push({ n: 'TWO-FORMS THREW: ' + String(err.message).slice(0, 130), p: false, d: '' })
} finally {
  try { await browser?.close() } catch {}
  await tearDown()
  const db = admin()
  const uid = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8')).user.id
  const q = await db.from('records').select('id').eq('owner_id', uid).is('deleted_at', null)
  R.push({ n: 'RESIDUE: no live records', p: !q.error && q.data.length === 0,
    d: q.error ? q.error.message : String(q.data.length) })
}
const failed = R.filter((r) => !r.p)
console.log(`\nTWO FORMS: ${R.length - failed.length}/${R.length}`)
for (const r of R) console.log(`  ${r.p ? 'ok  ' : 'FAIL'} ${r.n}${r.d ? '  | ' + r.d : ''}`)
