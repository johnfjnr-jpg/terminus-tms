// R6: the grid owns its dirty state. Four cases, and the fourth is why the
// one-line fix was rejected.
//
// CASES 1 AND 2 ARE THE CALIBRATION, in the same run: the guard is shown NOT
// firing on a clean grid and firing on a dirty one, so case 3's `false` is a
// reading rather than a default and case 4's `true` is not a guard that simply
// always fires.
//
// Case 4 is the partial save: one valid row, one the server refuses. The valid
// one saves and the invalid one stays, so the grid IS still dirty. A reset
// wired to onDone would have cleared the flag there and lost a person's work.
import { loadPuppeteer } from '/Users/johnfryatt/terminus-tms/scripts/lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('p1-dirty')
import { readFileSync } from 'node:fs'
const OWNER = JSON.parse(readFileSync('/Users/johnfryatt/terminus-tms/session-ref.json','utf8'))
const b = await puppeteer.launch({ headless: 'new' })
const p = await b.newPage()
await p.setViewport({ width: 1920, height: 1000 })
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
await p.evaluate((k,v)=>localStorage.setItem(k,v),'sb-anvildouaacbhsjytkii-auth-token',JSON.stringify(OWNER))
await p.reload({ waitUntil: 'networkidle0' })
await p.evaluate(()=>navigate('leads'))
await p.waitForSelector('#btn-new-contact',{visible:true})
const dlg = () => p.evaluate(() => !document.getElementById('discard-confirm-modal').classList.contains('hidden'))
const open = async () => {
  await p.click('#btn-new-contact')
  await p.waitForSelector('[data-testid="nlg-th-name"]',{visible:true})
  await p.waitForFunction(()=>(document.querySelector('[data-testid="nlg-industry_id-0"]')?.options.length??0)>1)
}
const type = async (k,r,v)=>{ const s=`[data-testid="nlg-${k}-${r}"]`; await p.click(s); await p.type(s,v) }
const fill = async (r, over={}) => {
  const ind = await p.evaluate(()=>document.querySelector('[data-testid="nlg-industry_id-0"]').options[1].value)
  const src = await p.evaluate(()=>document.querySelector('[data-testid="nlg-source-0"]').options[1].value)
  const v = { name:`p1dirty ${r}`, company:'Dirty Co', jobRole:'Head',
              email:`p1d${r}@example.invalid`, mobile:'+65 9000 0088', summary:'x', ...over }
  for (const k of ['name','company','jobRole','email','mobile','summary']) await type(k,r,v[k])
  await p.select(`[data-testid="nlg-industry_id-${r}"]`, ind)
  await p.select(`[data-testid="nlg-source-${r}"]`, src)
}
const results = []
const check = (n, pass, d) => { results.push({n,pass}); console.log(`  ${pass?'PASS':'FAIL'}  ${n}`); if(d) console.log(`        ${d}`) }

// 1. CLEAN, never touched
await open()
await p.click('#btn-close-new-contact')
let d1 = await dlg(); if (d1) await p.click('#discard-confirm-keep')
check('a clean grid does NOT warn', d1 === false, `dialogue: ${d1}`)

// 2. GENUINELY DIRTY
await open(); await fill(0)
await p.click('#btn-close-new-contact')
let d2 = await dlg(); if (d2) await p.click('#discard-confirm-keep')
check('a genuinely dirty grid DOES warn', d2 === true, `dialogue: ${d2}`)

// 3. SAVED / CLEAN - John's screenshot
await p.click('[data-testid="nlg-save"]')
await p.waitForFunction(()=>!!document.querySelector('[data-testid="new-lead-result"]'))
const msg = await p.$eval('[data-testid="new-lead-result"]',e=>e.textContent)
const cnt = await p.$eval('[data-testid="nlg-counts"]',e=>e.textContent)
await p.click('#btn-close-new-contact')
let d3 = await dlg(); if (d3) await p.click('#discard-confirm-keep')
check('a SAVED, clean grid does NOT warn', d3 === false, `"${msg}", grid "${cnt}", dialogue: ${d3}`)

// 4. PARTIAL SAVE - one valid row, one invalid. The valid saves, the invalid
//    stays, so the grid IS still dirty and MUST still warn. This is the case
//    the rejected one-line reset would have got wrong.
await open()
await fill(0)                                   // valid
await fill(1, { email: 'not-an-email' })        // invalid, stays behind
await p.click('[data-testid="nlg-th-name"]')
await p.waitForFunction(()=>document.querySelector('[data-testid="nlg-counts"]')?.textContent.includes('to correct'))
const before = await p.$eval('[data-testid="nlg-counts"]',e=>e.textContent)
await p.click('[data-testid="nlg-save"]')
await p.waitForFunction(()=>!!document.querySelector('[data-testid="new-lead-result"]'))
const pmsg = await p.$eval('[data-testid="new-lead-result"]',e=>e.textContent)
const left = await p.evaluate(()=>[...document.querySelectorAll('[data-testid^="nlg-row-"]')]
  .filter(r=>r.dataset.invalid==='true').length)
await p.click('#btn-close-new-contact')
let d4 = await dlg(); if (d4) await p.click('#discard-confirm-discard')
check('a PARTIAL save leaves the grid dirty, and it DOES warn', d4 === true && left === 1,
  `before "${before}", ${pmsg} ${left} invalid row(s) kept, dialogue: ${d4}`)
await p.screenshot({ path: '/Users/johnfryatt/terminus-tms/.verify/leads-card/p1-partial-save.png' })
const f = results.filter(r=>!r.pass)
console.log(`\n  ${results.length-f.length}/${results.length} checks pass`)
await b.close()
process.exit(f.length?1:0)
