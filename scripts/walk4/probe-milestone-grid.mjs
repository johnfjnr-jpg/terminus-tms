// R-O5/O6: THE MILESTONE GRID'S HEADERS ALIGN TO THEIR FIELDS.
//
// THE CLAIM IS A RELATIONSHIP BETWEEN TWO ELEMENTS, not a property of one.
// "the grid uses `display: grid`" would be true of a grid laid out anywhere;
// "`grid-template-columns` is 44px 195px 44px 64px" asserts the MECHANISM the
// fix happens to use and would survive any rewrite of the CSS while the
// headers sat 400px from their fields. What was claimed is that each header
// sits over the field it names, so that is what is measured: header.left
// against field.left, column by column.
//
// THE THRESHOLD COMES FROM THE REQUIREMENT. A header "aligns to its field"
// when a person reading down the column sees one line, so the tolerance is a
// pixel or two of sub-pixel rounding, not a number read off the result. 2px.
//
// AND O5 IN THE SAME PASS: the Month input is sized to its content. The
// requirement is the markup's own `maxLength=2`, and the width is the
// prototype's 44px, so the assertion is against the prototype rather than
// against whatever the box happens to measure today.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk4/probe-milestone-grid.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk4/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'w4grid'

const checks = []
const check = (ok, what, detail = '') => { checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`) }

const opp = await freshOpportunity(TAG)
const b = await puppeteer.launch({ headless: 'new' })
try {
  for (const width of [1440, 1240]) {
    const p = await b.newPage()
    await p.setViewport({ width, height: 1200 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      const c = document.getElementById('detail-company')
      return !!v && !v.classList.contains('is-loading') && !!c && (c.textContent ?? '').trim().length > 0
    }, { timeout: 25000 })
    await p.evaluate(() => {
      const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
        .find((x) => /commercial/i.test(x.textContent ?? ''))
      t?.click()
    })
    await p.waitForFunction(() => {
      const panel = document.getElementById('opp-tab-commercial')
      return !!panel && panel.querySelectorAll('.deal-section').length > 1
    }, { timeout: 25000 })
    await p.evaluate(() => { document.querySelector('[data-structure="hybrid"]')?.click() })
    await p.waitForFunction(() => {
      const g = document.getElementById('deal-hybrid-group')
      return !!g && !g.classList.contains('hidden')
        && !!g.querySelector('[data-testid="ms-grid-head"]')
    }, { timeout: 15000 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    const m = await p.evaluate(() => {
      const head = document.querySelector('[data-testid="ms-grid-head"]')
      const row = document.querySelector('[data-testid="milestone-grid"] .ms-grid-row')
      const r = (e) => e.getBoundingClientRect()
      const heads = head ? [...head.children].map((c) => ({ text: (c.textContent ?? '').trim(), left: Math.round(r(c).left), width: Math.round(r(c).width) })) : []
      const fields = row ? [...row.children].map((c) => ({ left: Math.round(r(c).left), width: Math.round(r(c).width) })) : []
      const month = document.querySelector('[data-testid="deal-ms-1-month"]')
      // The nested table must be GONE, not merely restyled.
      //
      // SCOPED THROUGH getElementById AND THE LIVE PANEL, never through a
      // descendant selector on the id. `#deal-hybrid-group` exists TWICE at
      // runtime: React renders one, and `index.html` carries another inside
      // the retired `#deal-form-vanilla` block, which still holds the OLD
      // table markup. `document.querySelector('#deal-hybrid-group table')`
      // matches a table under ANY element with that id, so it found the
      // corpse's and reported the fix as incomplete at both widths. The live
      // group has no table at all.
      const liveGroup = document.getElementById('opp-tab-commercial')
        ?.querySelector('#deal-hybrid-group:not(#deal-form-vanilla *)')
      const anyTable = !!liveGroup?.querySelector('table')
      return {
        heads, fields, anyTable,
        monthWidth: month ? Math.round(r(month).width) : null,
        monthMax: month ? month.getAttribute('maxlength') : null,
        // Every input in the row, so a border fragment cannot hide.
        borders: row ? [...row.children].map((c) => {
          const cs = getComputedStyle(c)
          return [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].join('/')
        }) : [],
      }
    })

    console.log(`\n=== ${width}px ===`)
    check(m.heads.length === 4 && m.fields.length === 4,
      'the header row and the field row each have four columns',
      `${m.heads.length} headers, ${m.fields.length} fields`)
    check(!m.anyTable, 'the nested table is GONE, not restyled', `table present: ${m.anyTable}`)

    const offsets = m.heads.map((h, i) => m.fields[i] ? h.left - m.fields[i].left : null)
    check(offsets.every((o) => o !== null && Math.abs(o) <= 2),
      'R-O6 every header sits over the field it names, within 2px',
      `offsets ${JSON.stringify(offsets)}`)
    m.heads.forEach((h, i) => console.log(`      ${h.text.padEnd(18)} header left=${String(h.left).padStart(5)}  field left=${String(m.fields[i]?.left ?? '-').padStart(5)}`))

    check(m.monthWidth === 44, 'R-O5 the Month field is the prototype\'s 44px',
      `${m.monthWidth}px, maxlength=${m.monthMax}`)
    check(m.monthMax === '2', 'and the two-character cap is still stated in the markup', `maxlength=${m.monthMax}`)
    // A grid has no cell walls: every input should carry the same edges, so
    // there is no fragment to see.
    // ONE treatment, not "at most two". The first version allowed two and
    // PASSED on the defect: three cells at `0px/0px/1px/0px` and the computed
    // one at `2px/2px/2px/2px`, the browser's own border showing through
    // because `.deal-section input:not(.is-computed)` excluded it. A threshold
    // that tolerates the thing being fixed is not a requirement.
    const distinct = [...new Set(m.borders)]
    check(distinct.length === 1,
      'the border treatment is uniform across the row, so no fragment remains',
      `${distinct.length} distinct: ${JSON.stringify(distinct)}`)

    await p.evaluate(() => { document.getElementById('deal-hybrid-group')?.scrollIntoView({ block: 'start' }) })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const inView = await p.evaluate(() => { const r2 = document.getElementById('deal-hybrid-group').getBoundingClientRect(); return r2.top < window.innerHeight && r2.bottom > 0 })
    await p.screenshot({ path: `${OUT}o56-grid-${width}.png` })
    console.log(`  captured o56-grid-${width}.png  (group in viewport: ${inView})`)
    await p.close()
  }
} finally { await b.close(); await tearDown(TAG) }

const failed = checks.filter((c) => !c).length
console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
process.exit(failed ? 1 : 0)
