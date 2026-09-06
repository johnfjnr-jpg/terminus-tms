// ── ROUND 5 PHASE 3 ITEM 2: THE ACCOUNT SURFACE, AND THE GUARD ──────────
//
// Round 2's close-out recorded a pixel diff near zero and an IDENTICAL
// geometry census between the vanilla and React Account surfaces. This
// session found that `.field-row` had no stylesheet rule at all - git says
// the first and only commit adding it is 09cce15, in Round 5 Phase 2. An
// unstyled React row and a flex vanilla row cannot have identical geometry,
// so both claims cannot be true.
//
// THE GUARD THAT WOULD HAVE CAUGHT IT, and it is the point of this file:
// a comparison asserts its two captures are of DIFFERENT implementations
// before it compares them. Identical geometry between two independent
// renderings is a TELL, not a result - Verification 49's "exact agreement is
// a tell" arriving in the visual dimension.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { admin } from '../fixtures.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const OUT = process.env.SHOTS ?? '/tmp/acct-shots'
mkdirSync(OUT, { recursive: true })
const WIDTHS = [1240, 1920, 3440]
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 190) })
const puppeteer = await loadPuppeteer('visual-account')
let browser = null

try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  const db = admin()
  const acct = await db.from('records').select('id').eq('record_type', 'account')
    .is('deleted_at', null).limit(1)
  const acctId = acct.data?.[0]?.id
  check('an Account exists to capture', !!acctId, String(acctId))
  if (!acctId) throw new Error('no account')

  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))

  const sizes = {}
  for (const width of WIDTHS) {
    await page.setViewport({ width, height: 1000 })
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForFunction(() =>
      typeof window.loadAccountDetail === 'function', { timeout: 25000 })
    await page.evaluate((id) => navigate('account-detail', id), acctId)
    await page.waitForFunction(() =>
      document.querySelectorAll('#view-account-detail [data-field]').length > 5,
    { timeout: 30000 })
    await settle()

    // ── THE GUARD: WHICH IMPLEMENTATION IS THIS? ────────────────────────
    // A capture that cannot say what it captured cannot be compared with
    // anything. frontend/account-detail.js was deleted at the Round 4 close,
    // so there is no vanilla here at all - and the probe SAYS so rather than
    // silently comparing React with itself.
    const which = await page.evaluate(() => ({
      reactRows: document.querySelectorAll('#view-account-detail [data-field]').length,
      vanillaRows: document.querySelectorAll('#view-account-detail .ref-field-display').length,
      vanillaScript: !!document.querySelector('script[src="/account-detail.js"]'),
    }))
    check(`at ${width}: the capture knows it is the REACT surface`,
      which.reactRows > 5 && which.vanillaRows === 0 && which.vanillaScript === false,
      JSON.stringify(which))

    // ── IS IT STYLED BY THIS SESSION'S RULES? ───────────────────────────
    const styled = await page.evaluate(() => {
      const row = document.querySelector('#view-account-detail .field-row')
      const label = row?.querySelector('.field-row-label')
      if (!row || !label) return { row: !!row, label: !!label }
      const rs = getComputedStyle(row), ls = getComputedStyle(label)
      return {
        row: true, label: true,
        display: rs.display,
        borderBottom: rs.borderBottomWidth,
        labelFlexBasis: ls.flexBasis,
        labelTransform: ls.textTransform,
        labelMono: ls.fontFamily.toLowerCase().includes('mono'),
      }
    })
    check(`at ${width}: the Account rows are STYLED - flex, a label column, a rule`,
      styled.display === 'flex' && styled.labelFlexBasis === '170px'
      && styled.borderBottom !== '0px',
      JSON.stringify(styled))
    check(`at ${width}: and the label carries the mono uppercase treatment`,
      styled.labelTransform === 'uppercase' && styled.labelMono === true,
      `${styled.labelTransform} mono=${styled.labelMono}`)

    const el = await page.$('#view-account-detail')
    await el.scrollIntoView()
    await settle()
    const box = await el.boundingBox()
    if (box && box.width > 200 && box.height > 60) {
      await el.screenshot({ path: `${OUT}/account-react__${width}.png` })
      sizes[`account@${width}`] = { w: Math.round(box.width), h: Math.round(box.height) }
    } else {
      check(`at ${width}: the capture has usable size`, false, JSON.stringify(box))
    }
  }
  check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '))
  writeFileSync(`${OUT}/sizes.json`, JSON.stringify(sizes, null, 2))
  console.log('\ncaptured:', JSON.stringify(sizes))
} catch (err) {
  R.push({ n: 'THREW: ' + String(err.message).slice(0, 150), p: false, d: '' })
} finally {
  try { await browser?.close() } catch {}
}
const failed = R.filter((r) => !r.p)
console.log(`\nACCOUNT VISUAL: ${R.length - failed.length}/${R.length}`)
for (const r of R) console.log(`  ${r.p ? 'ok  ' : 'FAIL'} ${r.n}${r.d ? '  | ' + r.d : ''}`)
process.exit(failed.length ? 1 : 0)
