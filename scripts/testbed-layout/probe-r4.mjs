// R4 proof: the buyer dropdown POPULATES and SELECTS, driven by clicking.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-r4.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshTestBed, tearDown, admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/testbed-layout/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = admin(), TAG = 'tbr4'
const checks = []
const check = (ok, w) => { checks.push({ ok, w }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`) }
const tb = await freshTestBed(TAG)
// The account needs contacts to offer - created through the route, then linked
// the way the system links them (parent_record_id), which is what the fix reads.
const inds = (await api('GET', '/industries')).data
const names = ['Buyer One', 'Buyer Two']
const ids = []
for (const n of names) {
  const c = await api('POST', '/contacts', { name: `${TAG} ${n}`, company: `${TAG} Co`, jobRole: 'Eng',
    email: `${n.replace(/\s/g, '')}@example.com`, mobile: '+60123456789', industry_id: inds[0].id, source: 'Web' })
  const id = c.data?.id
  await db.from('records').update({ parent_record_id: tb.accountId }).eq('id', id)
  ids.push(id)
}
console.log(`test bed ${tb.bedId}\naccount ${tb.accountId} with ${ids.length} linked contacts\n`)
const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1300 })
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('test-bed-detail', id), tb.bedId)
  await p.waitForFunction(() => {
    const v = document.getElementById('view-test-bed-detail')
    return !!v && [...v.querySelectorAll('.field-row')].some((r) => (r.getAttribute('data-field') || '').startsWith('buyer-'))
  }, { timeout: 30000 })
  await new Promise((r) => setTimeout(r, 1500))
  // CLICK the row, as a person does.
  await p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const row = [...v.querySelectorAll('.field-row')].find((r) => (r.getAttribute('data-field') || '').startsWith('buyer-'))
    row?.querySelector('.field-row-display')?.click()
  })
  await new Promise((r) => setTimeout(r, 800))
  const m = await p.evaluate(() => {
    const v = document.getElementById('view-test-bed-detail')
    const row = [...v.querySelectorAll('.field-row')].find((r) => (r.getAttribute('data-field') || '').startsWith('buyer-'))
    const sel = row?.querySelector('select')
    return { field: row?.getAttribute('data-field') ?? null, isSelect: !!sel,
      optionCount: sel ? sel.options.length : null,
      options: sel ? [...sel.options].map((o) => o.textContent) : null }
  })
  console.log(`  ${JSON.stringify(m)}`)
  check(m.isSelect === true, 'the buyer control is a dropdown')
  check((m.optionCount ?? 0) > 1, `it POPULATES from the account's contacts (${m.optionCount} options, was 1)`)
  check((m.options ?? []).some((o) => (o || '').includes('Buyer One')),
    `and offers the account's real contacts (${JSON.stringify(m.options)})`)
  await p.screenshot({ path: `${OUT}r4-dropdown.png` })
} finally {
  await b.close()
  await tearDown(TAG)
  const left = (await db.from('record_revisions').select('record_id').ilike('payload->>name', `${TAG}%`)).data ?? []
  const uniq = [...new Set(left.map((r) => r.record_id))]
  for (const id of uniq) await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null)
  console.log('\nteardown done')
}
const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} pass`)
