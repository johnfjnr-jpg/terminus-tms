import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('shot-contact.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { admin } from '../fixtures.mjs'
const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/contact-swap/`
mkdirSync(OUT, { recursive: true })
const W = Number(process.argv[2] ?? 1440)
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const db = admin()
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const cs = must(await db.from('records').select('id,owner_id')
  .eq('record_type','contact').eq('status','Qualified').is('deleted_at',null), 'c')
const mine = cs.filter((r) => r.owner_id === S.user.id)
const subject = mine[0] ?? cs[0]
console.log(`${cs.length} Qualified contacts, ${mine.length} owned by probe identity`)
console.log(`subject ${subject.id}  owned: ${subject.owner_id === S.user.id}`)
const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: W, height: 1200 })
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k,v)=>localStorage.setItem(k,v),'sb-anvildouaacbhsjytkii-auth-token',JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id)=>navigate('contact-detail',id), subject.id)
  await p.waitForFunction(()=>{
    const v=document.getElementById('view-contact-detail')
    return !!v && !v.classList.contains('hidden') && !!v.querySelector('[data-testid="contact-host"]')
  },{timeout:25000})
  await new Promise(r=>setTimeout(r,1600))
  await p.screenshot({ path: `${OUT}contact-detail-today-${W}.png`, fullPage: false })
  const d = await p.evaluate(()=>{
    const v=document.getElementById('view-contact-detail')
    const vis=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0}
    return {
      visibleOpenInputs: [...v.querySelectorAll('input,select,textarea')].filter(vis).length,
      displayRows: v.querySelectorAll('[data-key]').length,
      cards: v.querySelectorAll('[data-testid^="cd-card-"]').length,
      notMine: v.querySelectorAll('.is-not-mine').length,
      height: Math.round(v.getBoundingClientRect().height),
    }
  })
  console.log('CONTACT DETAIL:', JSON.stringify(d))
} finally { await b.close() }
