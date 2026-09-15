// Phase 0: reproduce the reported defect on the DETAIL screen, by CLICKING the
// control a person clicks. No function calls - the whole point is the user path.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-p0-repro.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/create-bug/`
mkdirSync(OUT, { recursive: true })
const MARK = 'CBUG'
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const db = admin()
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))

const industry = (await api('GET', '/industries')).data[0]
const id = (await api('POST', '/contacts', {
  name: `${MARK} Contact`, company: `${MARK} Co`, jobRole: 'Engineer',
  email: 'cbug@example.com', mobile: '+60123456789', industry_id: industry.id,
  source: 'Web', address: '1 Fixture Street', city: 'Singapore', postcode: '018956',
  country: 'Singapore', region: 'APAC', summary: 'A create-bug fixture.',
})).data?.id
const acct = must(await db.from('records').select('id').eq('record_type', 'account')
  .is('deleted_at', null).limit(1), 'acct')[0]
must(await db.from('records').update({ status: 'Qualified', parent_record_id: acct.id })
  .eq('id', id), 'promote')

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1100 })
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })

  // ── THE DETAIL SCREEN ──────────────────────────────────────────────────
  await p.evaluate((r) => navigate('contact-detail', r), id)
  await p.waitForFunction((n) => {
    const v = document.getElementById('view-contact-detail')
    return !!v && v.querySelector('[data-testid="cd-lead-name"]')?.textContent === n
  }, { timeout: 25000 }, `${MARK} Contact`)
  await new Promise((r) => setTimeout(r, 1200))

  const before = await p.evaluate(() => ({
    trigger: !!document.querySelector('[data-testid="cd-create"]'),
    menu: !!document.querySelector('[data-testid="cd-create-menu"]'),
  }))
  // What is AT the point, so "nothing happened" can be told from "something
  // else was clicked" (V14's elementFromPoint clause).
  const atPoint = await p.evaluate(() => {
    const t = document.querySelector('[data-testid="cd-create"]')
    if (!t) return 'no trigger'
    const r = t.getBoundingClientRect()
    const e = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2))
    return e ? `${e.tagName}.${e.className}`.slice(0, 50) : null
  })
  await p.click('[data-testid="cd-create"]')
  await new Promise((r) => setTimeout(r, 900))
  const after = await p.evaluate(() => {
    const m = document.querySelector('[data-testid="cd-create-menu"]')
    const t = document.querySelector('[data-testid="cd-create"]')
    return {
      menuInDom: !!m,
      menuHidden: m ? m.classList.contains('hidden') : null,
      menuClasses: m ? m.className : null,
      menuVisible: m ? (m.getBoundingClientRect().height > 0) : false,
      ariaExpanded: t?.getAttribute('aria-expanded') ?? null,
    }
  })
  console.log(`DETAIL screen`)
  console.log(`  before click : ${JSON.stringify(before)}  atPoint=${atPoint}`)
  console.log(`  after  click : ${JSON.stringify(after)}`)
  console.log(`  => ${after.menuVisible ? 'MENU OPENED' : 'NOTHING OPENED  <-- REPRODUCED'}`)
  await p.screenshot({ path: `${OUT}detail-after-click.png` })

  // ── THE CAUSAL TEST: neutralise the vanilla sweeper, click again ───────
  // If the menu then opens, the cause is that handler and not React's own
  // wiring. Nothing else is changed.
  // RESET FIRST. The previous click left React's menuOpen TRUE (the menu was
  // hidden, not closed), so clicking again would TOGGLE IT SHUT and the reading
  // would be about the toggle rather than about the sweeper. Re-navigating
  // remounts the surface with menuOpen false.
  // A RELOAD, not a re-navigation. Measured: navigating away and back left
  // menuOpen TRUE - this shell re-renders its root rather than remounting, so
  // component state survives navigation. That is its own finding and is not
  // this bug; here it just means only a reload gives a clean start.
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((r) => navigate('contact-detail', r), id)
  await p.waitForFunction(() => !!document.querySelector('[data-testid="cd-create"]'), { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 900))
  const reset = await p.evaluate(() => !!document.querySelector('[data-testid="cd-create-menu"]'))
  console.log(`  reset: menu present before the causal click = ${reset} (must be false)`)
  await p.evaluate(() => { window.__realClose = window.closeContactCreateMenus; window.closeContactCreateMenus = () => {} })
  await p.click('[data-testid="cd-create"]')
  await new Promise((r) => setTimeout(r, 900))
  const causal = await p.evaluate(() => {
    const m = document.querySelector('[data-testid="cd-create-menu"]')
    return { inDom: !!m, hidden: m ? m.classList.contains('hidden') : null, visible: m ? m.getBoundingClientRect().height > 0 : false }
  })
  console.log(`  with the vanilla sweeper neutralised: ${JSON.stringify(causal)}`)
  console.log(`  => ${causal.visible ? 'MENU OPENS. The sweeper is the cause.' : 'still closed - the cause is elsewhere'}`)
  await p.screenshot({ path: `${OUT}detail-sweeper-off.png` })
  await p.evaluate(() => { window.closeContactCreateMenus = window.__realClose })

  // ── THE LIST SCREEN, which the report says still works ─────────────────
  await p.evaluate(() => navigate('contacts'))
  await p.waitForFunction(() => document.querySelectorAll('.contact-create-trigger').length > 0, { timeout: 25000 })
  await new Promise((r) => setTimeout(r, 1200))
  await p.click('.contact-create-trigger')
  await new Promise((r) => setTimeout(r, 700))
  const list = await p.evaluate(() =>
    [...document.querySelectorAll('.contact-create-dropdown')].filter((d) => !d.classList.contains('hidden')).length)
  console.log(`LIST screen`)
  console.log(`  open dropdowns after click: ${list}  => ${list === 1 ? 'WORKS' : 'ALSO BROKEN'}`)
  await p.screenshot({ path: `${OUT}list-after-click.png` })
} finally {
  await b.close()
  const found = must(await db.from('record_revisions').select('record_id,payload')
    .ilike('payload->>name', `${MARK}%`), 'find')
  const ids = [...new Set(found.map((r) => r.record_id))]
  for (const r of ids) {
    must(await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', r).is('deleted_at', null), 'soft')
  }
  const left = must(await db.from('records').select('id,deleted_at').in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']), 're')
  console.log(`\nteardown: ${left.length} found, ${left.filter((r) => !r.deleted_at).length} live`)
}
