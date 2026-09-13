// ── FINDING AN INSTRUMENT THAT CAN SEE A SCROLL BAR ──────────────────────
//
// `offsetHeight - clientHeight` read 0 with AND without an injected 14px
// scrollbar, so it is blind in this browser and its 0 means nothing. This
// tries candidate instruments and reports which one MOVES between a state
// with a bar and a state without. Verification 18: a calibration that does
// not move the number has failed to run, not passed.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('grid-width/calibrate-barmeasure.mjs')
import { mkdirSync } from 'node:fs'
const OUT = '/Users/johnfryatt/terminus-tms/.verify/gridw/'
mkdirSync(OUT, { recursive: true })

// A self-contained page: a scrolling box, no application involved. If an
// instrument cannot see a bar HERE it cannot see one anywhere.
const PAGE = (styled) => `<!doctype html><html><body style="margin:0;background:#16181c">
<div id="box" style="width:400px;height:120px;overflow:auto;border:1px solid #555">
  <div style="width:2000px;height:60px;background:#333">wide</div>
</div>
${styled ? `<style>
  #box::-webkit-scrollbar{height:14px;width:14px;background:#2a2d33}
  #box::-webkit-scrollbar-thumb{background:#8a8f98;border-radius:7px}
</style>` : ''}
</body></html>`

const measure = async (page) => page.evaluate(() => {
  const b = document.getElementById('box')
  return { layoutGutter: b.offsetHeight - b.clientHeight, clientH: b.clientHeight, offsetH: b.offsetHeight }
})

for (const args of [[], ['--disable-features=OverlayScrollbar']]) {
  const label = args.length ? 'OverlayScrollbar DISABLED' : 'default flags'
  const browser = await puppeteer.launch({ headless: 'new', args })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 900, height: 400 })
    await page.setContent(PAGE(false)); await new Promise(r=>setTimeout(r,150))
    const plain = await measure(page)
    const shotA = await (await page.$('#box')).screenshot({ encoding: 'base64' })
    await page.setContent(PAGE(true)); await new Promise(r=>setTimeout(r,150))
    const styled = await measure(page)
    const shotB = await (await page.$('#box')).screenshot({ encoding: 'base64' })

    console.log(`=== ${label} ===`)
    console.log(`  layout gutter, unstyled bar : ${plain.layoutGutter}px`)
    console.log(`  layout gutter, styled 14px  : ${styled.layoutGutter}px`)
    console.log(`  gutter DISCRIMINATES        : ${styled.layoutGutter !== plain.layoutGutter}`)
    console.log(`  pixels differ between them  : ${shotA !== shotB}  (screenshot instrument)`)
  } finally { await browser.close() }
}
