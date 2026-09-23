// G7: THE PAYMENT PANELS PULL LEFT AND REDUCE TO CONTENT
//
// The measure is DEAD SPACE: the gap between the right edge of a panel's
// widest real content and the right edge of the panel's own content box. A
// panel wider than anything in it is space a reader's eye crosses for
// nothing, and it is the same shape C2's tier 1 measured on the statement.
//
// THREE WIDTHS, because a cap or a fixed column only shows at the wide one -
// this is exactly the defect that cannot be seen at 1240.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk12/probe-g7-payment.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk12/`
mkdirSync(OUT, { recursive: true })
const TAG = process.env.G7_TAG ?? 'before'
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}
// A hybrid deal, so the hybrid schedule and the milestone grid both render -
// a panel measured while its content is hidden reports dead space that is
// really an empty container.
const opps = must(await db.from('records').select('id, reference_code')
  .eq('record_type', 'opportunity').is('deleted_at', null).limit(500), 'opps')
let target = null
for (const o of opps) {
  const rev = must(await db.from('record_revisions').select('payload')
    .eq('record_id', o.id).order('revision_number', { ascending: false }).limit(1), 'rev')[0]
  if (rev?.payload?.structure === 'hybrid') { target = o; break }
}
if (!target) target = opps[0]
console.log(`measured on ${target.reference_code}`)

const MEASURE = () => {
  const panels = [
    ['payment terms panel', '.payment-terms-panel'],
    ['payment card', '.payment-card'],
    ['recovery group', '#deal-recovery-group'],
    ['hybrid group', '#deal-hybrid-group'],
    ['PO factoring panel', '.po-factoring-panel'],
  ]
  const out = []
  for (const [name, sel] of panels) {
    const el = document.querySelector(sel)
    if (!el || el.classList.contains('hidden') || !el.getBoundingClientRect().width) {
      out.push({ name, absent: true }); continue
    }
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    const innerRight = r.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth)
    const innerLeft = r.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth)
    // THE WIDEST REAL CONTENT, walked over leaves rather than the immediate
    // children: a full-width wrapper would report zero dead space while
    // everything inside it sits at the left.
    let widest = innerLeft
    let widestTag = null
    const walk = (n) => {
      for (const c of n.children) {
        const cr = c.getBoundingClientRect()
        const ccs = getComputedStyle(c)
        const isBox = ccs.display !== 'inline' && cr.width > 0 && cr.height > 0
        const leaf = !c.children.length
        if ((leaf || /TABLE|INPUT|SELECT|BUTTON/.test(c.tagName)) && isBox) {
          if (cr.right > widest) { widest = cr.right; widestTag = `${c.tagName.toLowerCase()}.${(c.className||'').toString().split(/\s+/)[0]}` }
        }
        if (!/TABLE|INPUT|SELECT/.test(c.tagName)) walk(c)
      }
    }
    walk(el)
    out.push({
      name, w: Math.round(r.width),
      inner: Math.round(innerRight - innerLeft),
      content: Math.round(widest - innerLeft),
      dead: Math.round(innerRight - widest),
      widestTag,
    })
  }
  return out
}

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  for (const width of [1240, 1440, 3440]) {
    console.log(`\n══════ ${width} ══════`)
    await p.setViewport({ width, height: 1200 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), target.id)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return v && !v.classList.contains('hidden') && !document.querySelector('.wrap.is-loading')
    }, { timeout: 45000 })
    await p.evaluate(() => {
      const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
        .find((x) => x.textContent.trim() === 'Commercials')
      t?.click()
    })
    await p.waitForFunction(() => !!document.querySelector('.payment-terms-panel'), { timeout: 45000 })
    await p.evaluate(() => document.fonts.ready)
    const m = await p.evaluate(MEASURE)
    for (const r of m) {
      if (r.absent) { console.log(`  ${r.name.padEnd(22)} (not rendered on this deal)`); continue }
      console.log(`  ${r.name.padEnd(22)} panel ${String(r.w).padStart(5)}px  content ${String(r.content).padStart(5)}px`
        + `  DEAD ${String(r.dead).padStart(5)}px   widest ${r.widestTag ?? '-'}`)
    }
    const live = m.filter((r) => !r.absent)
    check(live.length >= 3, `panels were found to measure at ${width}`, `${live.length}`)
    // THE REQUIREMENT, written before the numbers: a panel reduces to its
    // content, so the slack beside it is a gutter rather than a field.
    const CEILING = 120
    const fat = live.filter((r) => r.dead > CEILING).map((r) => `${r.name} ${r.dead}px`)
    check(fat.length === 0,
      `G7 every payment panel reduces to its content at ${width}`,
      fat.length ? fat.join('; ') : `worst ${Math.max(...live.map((r) => r.dead))}px against ${CEILING}px`)

    await p.evaluate(() => document.querySelector('.deal-payment-region')?.scrollIntoView({ block: 'center' }))
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const shot = `${OUT}g7-${TAG}-${width}.png`
    await p.screenshot({ path: shot })
    const inView = await p.evaluate(() => {
      const r = document.querySelector('.deal-payment-region')?.getBoundingClientRect()
      return !!r && r.top < innerHeight && r.bottom > 0 && r.height > 0
    })
    check(inView, `the payment region is inside the captured region at ${width}`, shot)
  }
} finally { await b.close() }
const bad = checks.filter((c) => !c).length
console.log(`\n${checks.length - bad}/${checks.length} checks passed`)
process.exit(bad ? 1 : 0)
