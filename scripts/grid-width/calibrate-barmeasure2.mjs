// Candidates round 2: a real navigation (not setContent), the standards
// `scrollbar-color`/`scrollbar-gutter` properties, and a headed browser.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('grid-width/calibrate-barmeasure2.mjs')
import { writeFileSync, mkdirSync } from 'node:fs'
const OUT = '/Users/johnfryatt/terminus-tms/.verify/gridw/'
mkdirSync(OUT, { recursive: true })

const html = (extra) => `<!doctype html><html><head><style>
  body{margin:0;background:#16181c}
  #box{width:400px;height:120px;overflow-x:scroll;overflow-y:hidden;border:0}
  #inner{width:2000px;height:60px;background:#333}
  ${extra}
</style></head><body><div id="box"><div id="inner">wide</div></div></body></html>`

const VARIANTS = {
  'plain overflow-x:scroll': '',
  'webkit-scrollbar 14px': `#box::-webkit-scrollbar{height:14px;background:#2a2d33}
     #box::-webkit-scrollbar-thumb{background:#8a8f98}`,
  'scrollbar-color + gutter': `#box{scrollbar-color:#8a8f98 #2a2d33;scrollbar-width:auto;scrollbar-gutter:stable}`,
}

for (const headless of ['new', false]) {
  let browser
  try { browser = await puppeteer.launch({ headless, args: ['--disable-features=OverlayScrollbar'] }) }
  catch (e) { console.log(`=== headless:${headless} -> CANNOT LAUNCH: ${String(e).slice(0,80)}\n`); continue }
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 900, height: 400 })
    console.log(`=== headless: ${headless} ===`)
    const shots = {}
    for (const [name, extra] of Object.entries(VARIANTS)) {
      await page.goto('data:text/html;charset=utf-8,' + encodeURIComponent(html(extra)),
        { waitUntil: 'load' })
      await new Promise(r => setTimeout(r, 250))
      const m = await page.evaluate(() => {
        const b = document.getElementById('box')
        return { gutter: b.offsetHeight - b.clientHeight }
      })
      const png = await (await page.$('#box')).screenshot({ encoding: 'base64' })
      shots[name] = png
      console.log(`  ${name.padEnd(26)} layout gutter ${m.gutter}px   png ${png.length} chars`)
    }
    const keys = Object.keys(shots)
    console.log(`  plain vs webkit-styled pixels differ : ${shots[keys[0]] !== shots[keys[1]]}`)
    console.log(`  plain vs scrollbar-color  differ     : ${shots[keys[0]] !== shots[keys[2]]}`)
    writeFileSync(`${OUT}bar-${headless}-plain.png`, Buffer.from(shots[keys[0]], 'base64'))
    writeFileSync(`${OUT}bar-${headless}-styled.png`, Buffer.from(shots[keys[1]], 'base64'))
    console.log()
  } finally { await browser.close() }
}
