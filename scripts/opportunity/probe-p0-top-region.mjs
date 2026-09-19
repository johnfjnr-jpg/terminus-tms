// Q1: THE OPPORTUNITY DETAIL'S CURRENT TOP REGION, MEASURED LIVE.
//
// What renders above the tab row today, and what a three-card row would join
// or displace. Measured on the real screen at the three widths Verification 10
// names, on an EXISTING record rather than a fixture, because the question is
// about the surface a person actually opens.
//
// EVERY MEASUREMENT PRECEDES EVERY CAPTURE, and the captures are of the PAGE:
// an element screenshot suppresses the scrollbar and does not put it back, so
// a probe that photographs the thing whose geometry is the claim is reading an
// instrument it has just perturbed.
//
// ARTEFACTS ARE NAMED AFTER THIS RUN, not after what they depict, because a
// probe copied from another inherits its output paths and overwrites the
// source run's evidence on its first execution.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
// Run: PUPPETEER_PATH=... node scripts/opportunity/probe-p0-top-region.mjs
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('opportunity/probe-p0-top-region.mjs')
import { readFileSync, mkdirSync } from 'node:fs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/opp-p0/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const OPP = process.argv[2] || '24d42569-1b0b-4378-aae9-e3aadaea876e'
const WIDTHS = [1240, 1920, 3440]

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1240, height: 900 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate((id) => navigate('opportunity-detail', id), OPP)

  // WAIT ON RENDERED CONTENT, never on a container. `#opp-headline` and
  // `#opp-detail-tabs` both exist in the STATIC markup from page load, so a
  // wait on either is satisfied before the record has arrived. The
  // counterfactual: an unopened record has an EMPTY headline and a blank
  // name, so both of those must carry text.
  // THE FIRST VERSION OF THIS WAIT REQUIRED THE H1 TO CARRY TEXT AND TIMED
  // OUT, which is recorded because the timeout was the finding rather than a
  // harness fault: the record is named "Willowglen" in the database and the
  // title h1 renders EMPTY. The name reaches `#detail-company`, the sub-line
  // beneath it, only. So the wait is on the sub-line and the headline, both of
  // which are empty in the static markup and carry text only once the record
  // has arrived.
  await p.waitForFunction(() => {
    const v = document.getElementById('view-opportunity-detail')
    const c = document.getElementById('detail-company')
    const h = document.getElementById('opp-headline')
    return !!v && !v.classList.contains('is-loading')
        && !!c && (c.textContent ?? '').trim().length > 0
        && !!h && (h.textContent ?? '').trim().length > 0
  }, { timeout: 20000 })

  // The title region in its own right, because Q1 is about what renders at the
  // top and this is the part that does not.
  const title = await p.evaluate(() => {
    const h1 = document.getElementById('ref-display-name')
    const edit = document.getElementById('ref-edit-name')
    const sub = document.getElementById('detail-company')
    const cs = edit ? getComputedStyle(edit) : null
    return {
      h1Text: (h1?.textContent ?? ''), h1Rect: h1 ? h1.getBoundingClientRect().height : null,
      subText: (sub?.textContent ?? ''),
      editHasHiddenAttr: edit ? edit.hasAttribute('hidden') : null,
      editHasHiddenClass: edit ? edit.classList.contains('hidden') : null,
      editDisplay: cs ? cs.display : null,
      editHeight: edit ? Math.round(edit.getBoundingClientRect().height) : null,
    }
  })
  console.log('\n=== THE TITLE REGION ===')
  console.log(`  h1#ref-display-name text: ${JSON.stringify(title.h1Text)}  rendered height ${title.h1Rect}`)
  console.log(`  p#detail-company text:    ${JSON.stringify(title.subText)}`)
  console.log(`  #ref-edit-name: .hidden class=${title.editHasHiddenClass}  hidden attr=${title.editHasHiddenAttr}  computed display=${title.editDisplay}  height=${title.editHeight}`)

  for (const w of WIDTHS) {
    await p.setViewport({ width: w, height: 900 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    const m = await p.evaluate(() => {
      const view = document.getElementById('view-opportunity-detail')
      const tabs = document.getElementById('opp-detail-tabs')
      const tabTop = tabs.getBoundingClientRect().top + window.scrollY
      const rows = []
      for (const el of view.children) {
        const r = el.getBoundingClientRect()
        const vis = r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none'
        rows.push({
          id: el.id || `(${el.className || el.tagName.toLowerCase()})`,
          cls: el.className || '',
          vis, top: Math.round(r.top + window.scrollY), h: Math.round(r.height), w: Math.round(r.width),
          text: (el.textContent || '').trim().slice(0, 40).replace(/\s+/g, ' '),
        })
      }
      return { tabTop, rows, viewW: Math.round(view.getBoundingClientRect().width), scrollH: document.documentElement.scrollHeight }
    })

    console.log(`\n=== ${w}px ===  view width ${m.viewW}, tab row starts at y=${Math.round(m.tabTop)}, page scrollHeight ${m.scrollH}`)
    console.log('  VISIBLE children of the view, above and below the tabs:')
    for (const r of m.rows) {
      if (!r.vis) continue
      const where = r.top < m.tabTop ? 'ABOVE' : (r.top === Math.round(m.tabTop) ? 'TABS ' : 'below')
      console.log(`    ${where}  y=${String(r.top).padStart(4)}  h=${String(r.h).padStart(4)}  w=${String(r.w).padStart(4)}  ${r.id.padEnd(22)} ${r.text}`)
    }
    const hidden = m.rows.filter((r) => !r.vis)
    console.log(`  and ${hidden.length} children render nothing: ${hidden.map((r) => r.id).join(', ')}`)
  }

  // CAPTURES LAST, and of the PAGE.
  //
  // AND EACH CAPTURE RE-WAITS FOR THE LOADED STATE FIRST, which the first
  // version did not: all three images came back showing "Loading the record...",
  // because the surface re-enters its loading state on a viewport change and a
  // capture loop that only waits for two animation frames photographs that.
  // Every programmatic check in this probe passed on that run. The images were
  // found by OPENING one, which is the only instrument that could have.
  // AND THE WAIT ITSELF WAS WRONG, WHICH THE SECOND ROUND OF IMAGES FOUND.
  //
  // `.is-loading > * { visibility: hidden }` is how this shell covers a
  // detail view while it loads. VISIBILITY PRESERVES LAYOUT, so every child
  // keeps a full, correct, non-zero bounding box the whole time it is
  // invisible. A wait on rendered TEXT is therefore satisfied under the
  // overlay, and so is a guard asserting the tab row "is on screen": both
  // passed while the capture showed nothing but "Loading the record...".
  //
  // The only honest signal is the class the shell actually toggles.
  const loaded = () => p.waitForFunction(() => {
    const v = document.getElementById('view-opportunity-detail')
    const c = document.getElementById('detail-company')
    const h = document.getElementById('opp-headline')
    return !!v && !v.classList.contains('is-loading')
        && !!c && (c.textContent ?? '').trim().length > 0
        && !!h && (h.textContent ?? '').trim().length > 0
  }, { timeout: 20000 })

  for (const w of WIDTHS) {
    await p.setViewport({ width: w, height: 900 })
    await loaded()
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    // The capture is only evidence if the thing is in it, so the probe asserts
    // the tab row is on screen rather than trusting the image.
    const shown = await p.evaluate(() => {
      const t = document.getElementById('opp-detail-tabs')?.getBoundingClientRect()
      return !!t && t.height > 0 && t.top < window.innerHeight
    })
    await p.screenshot({ path: `${OUT}p0-top-region-${w}.png` })
    console.log(`captured ${OUT}p0-top-region-${w}.png   tab row inside the capture: ${shown}`)
  }
} finally { await b.close() }
