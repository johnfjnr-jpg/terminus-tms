// ── IS THE CURRENT-STAGE DOT VISIBLE? ───────────────────────────────────
//
// NOT "does the element exist". That question passed for the entire life of
// the defect: the span was in the DOM, carried both its classes, and sat on
// the right tab, while rendering as a 6px transparent circle nobody could
// see. John found it by reading the stylesheet.
//
// So this measures the two properties that decide whether a person sees it,
// and it measures them as COMPUTED values rather than as declarations:
//
//   the painted colour   getComputedStyle().backgroundColor
//   the painted SIZE     getBoundingClientRect(), which is 0x0 for an inline
//                        element however much width the class asks for
//
// The size is the half the colour alone would have missed. `.sa-dot` sets a
// width and a height that do nothing to an inline element inside a <button>,
// and the vanilla documents that trap at markOppCurrentStageTab.
//
// AND IT CROPS THE CAPTURE TO THE TAB STRIP. A full-page screenshot of a
// 1440x1500 screen renders a 6px dot at a size nobody can adjudicate, which
// is Verification 4's own clause: opening the screenshot only helps if the
// thing is legible in it.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../../', import.meta.url))
const DIST = join(REPO, '.verify/walk2/harness')
const PAGE = 'frontend-react/harness/index.html'
const OUT = join(REPO, '.verify/walk2')
const LABEL = process.argv[2] ?? 'dot'
const EXEC = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
if (!existsSync(join(DIST, PAGE))) throw new Error('build the harness first')
mkdirSync(OUT, { recursive: true })

const { loadPuppeteer } = await import('../lib/puppeteer.mjs')
const puppeteer = await loadPuppeteer('probe-dot.mjs')

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }
const server = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '')
  try {
    const body = await readFile(join(DIST, p))
    res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' })
    res.end(body)
  } catch { res.writeHead(404); res.end('not found') }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${server.address().port}/`

const browser = await puppeteer.launch({
  executablePath: EXEC, headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 3 })
await page.goto(BASE + PAGE, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => !!document.querySelector('[data-testid="tb-detail-tabs"]'),
  { timeout: 20000 })
await new Promise((r) => setTimeout(r, 200))

// MEASURE FIRST. A capture can perturb its subject, and every number below
// is taken before any screenshot is asked for.
const m = await page.evaluate(() => {
  const DOT = '[data-testid="tb-tab-dot-stage-Qualification"]'
  const dot = document.querySelector(DOT)
  if (!dot) return { present: false }
  const cs = getComputedStyle(dot)
  const r = dot.getBoundingClientRect()
  const tab = dot.closest('.detail-tab')
  const strip = document.querySelector('[data-testid="tb-detail-tabs"]')
  const sr = strip.getBoundingClientRect()
  return {
    present: true,
    backgroundColor: cs.backgroundColor,
    display: cs.display,
    width: Math.round(r.width * 100) / 100,
    height: Math.round(r.height * 100) / 100,
    borderRadius: cs.borderRadius,
    // WHICH TAB it marks, because a visible dot on the wrong tab is a
    // different defect wearing the same green.
    onTab: tab ? tab.textContent.trim() : null,
    // The dot sits to the LEFT of its own tab's label: a relation between
    // two elements rather than a property of one.
    leftOfLabel: tab ? Math.round(r.left) < Math.round(tab.getBoundingClientRect().right) : null,
    // How many dots render in the whole strip. Exactly one stage is current.
    dotsInStrip: document.querySelectorAll('[data-testid^="tb-tab-dot-"]').length,
    strip: { x: Math.round(sr.x), y: Math.round(sr.y),
      w: Math.round(sr.width), h: Math.round(sr.height) },
  }
})

const TRANSPARENT = new Set(['rgba(0, 0, 0, 0)', 'transparent'])
const verdict = []
if (!m.present) verdict.push('the dot element does not render at all')
else {
  if (TRANSPARENT.has(m.backgroundColor)) verdict.push(`the dot is TRANSPARENT (${m.backgroundColor})`)
  if (m.width === 0 || m.height === 0) {
    verdict.push(`the dot paints at ${m.width}x${m.height} - an inline element ignores `
      + `.sa-dot's width and height, so a colour alone would not have shown it`)
  }
  if (m.dotsInStrip !== 1) verdict.push(`${m.dotsInStrip} dots render; exactly one stage is current`)
}

console.log(`\n  THE CURRENT-STAGE DOT - ${LABEL}\n`)
console.log(`  present          ${m.present}`)
if (m.present) {
  console.log(`  backgroundColor  ${m.backgroundColor}`)
  console.log(`  display          ${m.display}`)
  console.log(`  painted size     ${m.width} x ${m.height}`)
  console.log(`  border-radius    ${m.borderRadius}`)
  console.log(`  on tab           ${JSON.stringify(m.onTab)}`)
  console.log(`  dots in strip    ${m.dotsInStrip}`)
}
console.log('')
console.log(verdict.length ? verdict.map((v) => '  INVISIBLE OR WRONG  ' + v).join('\n')
  : '  VISIBLE  a painted, non-transparent, non-zero-size dot on the current stage tab')

// CAPTURE LAST, cropped to the strip, at deviceScaleFactor 3 so a 6px dot is
// 18px in the image and a person can actually adjudicate it.
await page.screenshot({
  path: join(OUT, `${LABEL}-strip.png`),
  clip: { x: m.strip.x - 8, y: m.strip.y - 8, width: m.strip.w + 16, height: m.strip.h + 16 },
})
await browser.close()
server.close()
console.log(`\n  written: .verify/walk2/${LABEL}-strip.png`)
process.exit(verdict.length ? 1 : 0)
