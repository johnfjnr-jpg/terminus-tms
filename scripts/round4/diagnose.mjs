// FINDING 1, MECHANISM. Three candidates, all measured, none assumed.
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const puppeteer = await loadPuppeteer('diagnose')
let browser = null
const { oppId } = await freshOpportunity('R4DIAG')
{ const db = admin(); await db.from('records').update({ status: 'Proposal' }).eq('id', oppId) }
try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 950 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => typeof window.initOpportunityDealPanel === 'function', { timeout: 25000 })
  await page.evaluate((id) => navigate('opportunity-detail', id), oppId)
  await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
  await page.waitForFunction(() => {
    const r = document.getElementById('deal-version-root')
    return r?.querySelector('#deal-version-panel') && (r.innerText ?? '').trim().length > 20
  }, { timeout: 30000 })
  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))

  // Where does the version root sit relative to the form's blocks?
  console.log('\n── STRUCTURE ──')
  console.log(JSON.stringify(await page.evaluate(() => {
    const vr = document.getElementById('deal-version-root')
    const fv = document.getElementById('deal-form-vanilla')
    const fr = document.getElementById('deal-form-root')
    return {
      versionRootInsideFormVanilla: !!fv?.contains(vr),
      versionRootInsideFormReactRoot: !!fr?.contains(vr),
      formVanillaHidden: !!fv?.classList.contains('hidden'),
      versionRootParentId: vr?.parentElement?.id || vr?.parentElement?.className,
    }
  }), null, 1))

  for (let n = 1; n <= 6; n++) {
    await page.evaluate(() => { const w = window; w.__diag.renders = []; w.__diag.reasonHistory = [] })
    const was = await page.evaluate(() => document.getElementById('deal-ssExisting')?.value)
    await page.click('#deal-ssExisting')
    await page.keyboard.down('Meta'); await page.keyboard.press('a'); await page.keyboard.up('Meta')
    await page.type('#deal-ssExisting', String((Number(was) || 0) + 3), { delay: 1 })
    await settle()
    const REASON = `round ${n}: the rate card moved and the margin was held`
    await page.click('#deal-version-reason')
    // SLOW typing, because a person types slowly and that widens the window a
    // synchronous root.render has to land in.
    await page.type('#deal-version-reason', REASON, { delay: 60 })
    await settle()
    const d = await page.evaluate(() => ({
      box: document.querySelector('#deal-version-root #deal-version-reason')?.value.length ?? -1,
      diag: JSON.parse(JSON.stringify({ ...window.__diag, lastContainer: undefined, lastSeam: undefined })),
    }))
    await page.evaluate(() => document.querySelector('#deal-version-root #btn-save-version')?.click())
    await page.waitForFunction(() => {
      const p = document.querySelector('#deal-version-root #deal-version-feedback')
      return p && !p.className.includes('hidden') && (p.textContent ?? '').length > 0
    }, { timeout: 20000 }).catch(() => {})
    await settle()
    const fb = await page.evaluate(() => document.querySelector('#deal-version-root #deal-version-feedback')?.textContent ?? '')
    const rendersWhileTyping = d.diag.renders.filter((r) => r.focused === 'deal-version-reason')
    console.log(`\n── SAVE ${n} ── typed ${REASON.length}, box at click ${d.box}`)
    console.log(`   init calls ${d.diag.initCalls}  containerSwaps ${d.diag.containerSwaps}  `
      + `containerDetached ${d.diag.containerDetached}`)
    console.log(`   cardMounts ${d.diag.cardMounts}  cardUnmounts ${d.diag.cardUnmounts}  `
      + `seamNew ${d.diag.seamNew}  seamIdentical ${d.diag.seamIdentical}`)
    console.log(`   renders during this cycle ${d.diag.renders.length}, `
      + `OF WHICH WHILE THE REASON BOX HAD FOCUS: ${rendersWhileTyping.length}`)
    if (rendersWhileTyping.length) {
      console.log('   box length at each such render: '
        + rendersWhileTyping.map((r) => r.boxLen).join(', '))
    }
    const rh = d.diag.reasonHistory.map((r) => r.len)
    console.log(`   reason state went: ${rh.length > 14 ? rh.slice(0, 7).join(',') + ' … ' + rh.slice(-7).join(',') : rh.join(',')}`)
    console.log(`   RESULT ${fb.slice(0, 80)}`)
    await new Promise((r) => setTimeout(r, 800))
  }
} catch (e) {
  console.log('THREW', e.message)
} finally {
  try { await browser?.close() } catch {}
  await tearDown()
}
