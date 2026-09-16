// ── THE WALK-2 LAYOUT PROBE ──────────────────────────────────────────────
//
// Drives the harness in a real browser and measures the five layout claims
// as RELATIONSHIPS BETWEEN TWO ELEMENTS, never as a CSS property of one.
// CLAUDE.md Verification 4's clause: `position: absolute` is how a layout is
// achieved; where a thing sits relative to another thing is what was claimed,
// and the two checks that asserted the mechanism both passed on a list
// rendering 730px below its card.
//
// MEASURE FIRST, CAPTURE SECOND. Puppeteer suppresses the scrollbar to take a
// capture and does not put it back, so a probe that photographs and then
// measures is reading a bar its own instrument removed. Every rect below is
// taken before any screenshot, and the capture is of the PAGE.
//
// THE CLICK CLAIMS ARE EFFECTS, NOT PRESENCE. W3 and W5 move action buttons,
// and a moved button that renders perfectly and does nothing is a defect this
// estate has already shipped. The harness's stub handlers push onto
// `window.__walk2Clicks`, so the assertion is that a real browser click
// CHANGED something, and each is guarded by its own counterfactual: the
// ledger is read before the click as well as after.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../../', import.meta.url))
const DIST = join(REPO, '.verify/walk2/harness')
const PAGE = 'frontend-react/harness/index.html'
const OUT = join(REPO, '.verify/walk2')
const LABEL = process.argv[2] ?? 'run'
const EXEC = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

if (!existsSync(join(DIST, PAGE))) {
  throw new Error('the harness is not built: run scripts/testbed-walk2/build-harness.mjs first')
}
mkdirSync(OUT, { recursive: true })

// ONE RESOLVER, the estate's own. Six probes each carried their own copy of
// this and Round 41 fixed three of them; `scripts/lib/puppeteer.mjs` exists so
// there is one place for it to be wrong (Verification 37).
const { loadPuppeteer } = await import('../lib/puppeteer.mjs')
const puppeteer = await loadPuppeteer('probe-walk2.mjs')

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.map': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' }

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
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars=false'],
})

/**
 * The measurement, taken INSIDE the page.
 *
 * `baseline` is the text baseline of a single-line element, derived from a
 * Range over its own text rather than from the element box: a heading and a
 * paragraph with different font sizes have different box bottoms while
 * sharing a baseline, and "bottom-aligned to the title" is the typographic
 * claim, not the box one.
 */
const MEASURE = () => {
  const q = (t) => document.querySelector(`[data-testid="${t}"]`)
  const rect = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left),
      right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) }
  }
  /**
   * THE TRUE BASELINE, and the first version of this was WRONG.
   *
   * It took a Range over the text node and read `getClientRects()[0].bottom`.
   * That is the bottom of the LINE BOX, which includes the descender space,
   * so a 30px heading and a 14px paragraph sitting on ONE baseline report
   * bottoms 3px apart - and the probe read `-3` against a layout that was
   * correct. Verification 33's sharpest form: a measure aimed at the wrong
   * half of a property that has more than one.
   *
   * A zero-size `inline-block` sits with its bottom margin edge ON the
   * baseline of the line it is in, which is the one thing in CSS that
   * reports a baseline directly. It adds no width and no height, it is
   * removed immediately, and the caller asserts the element's own rect is
   * unchanged afterwards - an instrument must not perturb its subject.
   */
  const baseline = (el) => {
    if (!el) return null
    const before = el.getBoundingClientRect()
    const probe = document.createElement('span')
    probe.style.cssText = 'display:inline-block;width:0;height:0;overflow:hidden'
    el.appendChild(probe)
    const b = probe.getBoundingClientRect().bottom
    probe.remove()
    const after = el.getBoundingClientRect()
    if (Math.round(before.height) !== Math.round(after.height)
      || Math.round(before.top) !== Math.round(after.top)) {
      throw new Error('the baseline probe moved the element it was measuring')
    }
    return Math.round(b)
  }
  const name = q('tb-detail-name'), client = q('tb-detail-client')
  const headerRow = q('tb-header-row'), stats = q('tb-header-stats')
  const tabs = q('tb-detail-tabs'), next = q('tb-next-stage-btn')
  const convert = q('tb-convert-trigger')
  const cdHeader = q('tb-header')
  const terminus = q('tb-card-terminus')
  const nameRow = q('display-name')
  const summaryRow = q('display-summary')

  const doc = document.documentElement
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    name: rect(name), client: rect(client),
    // TWO DIMENSIONS, NAMED AND BOTH ASSERTED. "Bottom aligned" can mean the
    // text baselines agree or the boxes agree, and for two different type
    // sizes those are different claims with different right answers. The
    // baseline is the typographic one and is what `align-items: baseline`
    // produces; the box bottoms are recorded so the report can say which.
    nameBaseline: baseline(name), clientBaseline: baseline(client),
    headerRow: rect(headerRow), stats: rect(stats),
    gapHeaderToStats: headerRow && stats
      ? Math.round(stats.getBoundingClientRect().top - headerRow.getBoundingClientRect().bottom)
      : null,
    tabs: rect(tabs), next: rect(next), convert: rect(convert),
    nextInsideTabs: !!(tabs && next && tabs.contains(next)),
    convertInHeaderRow: !!(headerRow && convert && headerRow.contains(convert)),
    cdHeaderPresent: !!cdHeader,
    nameRowPresent: !!nameRow,
    nameRowInTerminusCard: !!(terminus && nameRow && terminus.contains(nameRow)),
    summaryRowPresent: !!summaryRow,
    // The page must not scroll sideways at any width the estate measures at.
    horizontalOverflow: Math.round(doc.scrollWidth - doc.clientWidth),

    // ── WHAT MUST REMAIN, BY NAME ─────────────────────────────────────
    //
    // Verification 7: a change is two claims, and a REPLACEMENT flips the
    // polarity of the second - what arrived is there, AND everything that
    // was already there still is. A screenshot of the thing that moved
    // cannot show what stopped rendering somewhere else, and this round
    // moves four things at once.
    cards: [...document.querySelectorAll('[data-testid^="tb-card-"]')]
      .map((e) => e.getAttribute('data-testid')).sort(),
    // ── AND EXACTLY ONE OF EACH, NOT AT LEAST ONE ─────────────────────
    //
    // A move that leaves the original in place renders both, and "the new
    // one is there" passes on that. This estate has shipped that duplicate
    // and the business found it.
    counts: Object.fromEntries(['tb-convert-trigger', 'tb-next-stage-btn',
      'display-name', 'display-summary', 'tb-card-summary', 'tb-card-notes',
      'tb-top-row', 'tb-header-row']
      .map((t) => [t, document.querySelectorAll(`[data-testid="${t}"]`).length])),
    // W1's BLAST RADIUS, stated as a relation rather than an absolute: the
    // header change moves everything below it down the page, so the Summary
    // and Notes band's screen position is EXPECTED to shift. What must not
    // change is where it sits inside the panel it belongs to.
    topRowWithinPanel: (() => {
      const panel = q('testbed-panel'), topRow = q('tb-top-row')
      if (!panel || !topRow) return null
      return Math.round(topRow.getBoundingClientRect().top
        - panel.getBoundingClientRect().top)
    })(),
  }
}

const rows = []
for (const width of [1240, 1440, 1920]) {
  const page = await browser.newPage()
  await page.setViewport({ width, height: 1000 })
  await page.goto(BASE + PAGE, { waitUntil: 'domcontentloaded' })
  // A CONDITION THE PREVIOUS STATE CANNOT SATISFY. The Next Stage action does
  // not render at all until `/api/stage-definitions` has answered, so waiting
  // on it waits for a loaded surface rather than for a mounted one - and the
  // counterfactual, an unloaded surface, has no such element. The name is
  // waited on too, because the button exists on a failed load as well.
  await page.waitForFunction(() => {
    const n = document.querySelector('[data-testid="tb-next-stage-btn"]')
    const t = document.querySelector('[data-testid="tb-detail-name"]')
    return !!n && !!t && (t.textContent ?? '').trim().length > 0
  }, { timeout: 20000 })
  // One interaction, then YIELD, then assert: React re-renders asynchronously
  // and a synchronous read after a synchronous dispatch measures the frame
  // before the click.
  await new Promise((r) => setTimeout(r, 150))

  const m = await page.evaluate(MEASURE)
  rows.push({ width, ...m })
  // CAPTURE AFTER EVERY MEASUREMENT, and of the page, never of the element.
  await page.screenshot({ path: join(OUT, `${LABEL}-${width}.png`), fullPage: true })
  await page.close()
}

// ── THE CLICK CLAIMS, at one width. Position is a property of the layout;
//    whether the handler fires is not, so it is measured once.
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000 })
await page.goto(BASE + PAGE, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => !!document.querySelector('[data-testid="tb-next-stage-btn"]'),
  { timeout: 20000 })

const clicks = {}
{
  // ── THE BUTTON IS GATED, AND THAT GATE IS THE COUNTERFACTUAL ──────────
  //
  // `nextStageState` disables Next Stage unless the tab open is the RECORD'S
  // OWN stage tab, so the surface lands with it disabled. Measured rather
  // than assumed: the first run of this probe clicked it on the Reference
  // tab, the ledger stayed empty, and that reads exactly like a moved button
  // whose handler no longer fires.
  //
  // So both states are recorded. Disabled-and-silent is the negative case
  // that gives the positive one meaning; without it, "the ledger grew" is
  // satisfied by a button that fires on every state including the wrong one.
  clicks.nextDisabledOnReference = await page.evaluate(() =>
    document.querySelector('[data-testid="tb-next-stage-btn"]').disabled)
  await page.click('[data-testid="tb-tab-btn-stage-Qualification"]')
  // WAIT ON THE STATE, not on a delay: the tab activation is asynchronous and
  // a fixed sleep would resolve against whichever frame it landed in.
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="tb-next-stage-btn"]')?.disabled === false,
  { timeout: 20000 })

  // The counterfactual is read first: a ledger that already held the entry
  // would make the assertion pass without the click doing anything.
  clicks.nextBefore = await page.evaluate(() => window.__walk2Clicks.slice())
  // WHAT IS AT THE POINT, not merely whether the element is there. A button
  // that is present, enabled and in view can still be under something.
  const at = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="tb-next-stage-btn"]')
    b.scrollIntoView({ block: 'center' })
    const r = b.getBoundingClientRect()
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return { disabled: b.disabled, label: b.textContent, hit: el === b || b.contains(el),
      hitTag: el ? `${el.tagName}.${(el.className || '-')}` : null }
  })
  await page.click('[data-testid="tb-next-stage-btn"]')
  await new Promise((r) => setTimeout(r, 150))
  clicks.next = { ...at, after: await page.evaluate(() => window.__walk2Clicks.slice()) }
}
{
  // CONVERT. Its handler is React state rather than a shell call, so the
  // effect asserted is the form opening - the thing the button is FOR.
  const at = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="tb-convert-trigger"]')
    b.scrollIntoView({ block: 'center' })
    const r = b.getBoundingClientRect()
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return { formBefore: !!document.querySelector('[data-testid="tb-convert-form-wrap"]'),
      hit: el === b || b.contains(el),
      hitTag: el ? `${el.tagName}.${(el.className || '-')}` : null }
  })
  await page.click('[data-testid="tb-convert-trigger"]')
  await new Promise((r) => setTimeout(r, 150))
  clicks.convert = { ...at,
    formAfter: await page.evaluate(() =>
      !!document.querySelector('[data-testid="tb-convert-form-wrap"]')) }
  await page.screenshot({ path: join(OUT, `${LABEL}-convert-open.png`), fullPage: true })
}
await page.close()
await browser.close()
server.close()

const out = { label: LABEL, rows, clicks }
const { writeFileSync } = await import('node:fs')
writeFileSync(join(OUT, `${LABEL}.json`), JSON.stringify(out, null, 2))

console.log(`\n  TEST BED WALK 2 - ${LABEL}\n`)
console.log('  width  name/client  same row  baseline gap  box-bottom gap  hdr->stats gap  next in tabs  convert in hdr  cd-header  name row     overflow')
for (const r of rows) {
  const sameRow = r.name && r.client ? (Math.abs(r.name.top - r.client.top) < r.name.height) : null
  const bgap = r.nameBaseline != null && r.clientBaseline != null
    ? r.clientBaseline - r.nameBaseline : null
  console.log(`  ${String(r.width).padEnd(6)} `
    + `${(r.name ? 'y' : 'n')}/${(r.client ? 'y' : 'n')}`.padEnd(12)
    + String(sameRow).padEnd(10)
    + String(bgap).padEnd(14)
    + String(r.name && r.client ? r.client.bottom - r.name.bottom : null).padEnd(16)
    + String(r.gapHeaderToStats).padEnd(16)
    + String(r.nextInsideTabs).padEnd(14)
    + String(r.convertInHeaderRow).padEnd(16)
    + String(r.cdHeaderPresent).padEnd(11)
    + `${r.nameRowPresent ? 'y' : 'n'}${r.nameRowInTerminusCard ? '/terminus' : ''}`.padEnd(12)
    + String(r.horizontalOverflow))
}
console.log('\n  CLICKS')
console.log(`  next stage    disabled on Reference=${clicks.nextDisabledOnReference} `
  + `-> on its own stage tab disabled=${clicks.next.disabled}`)
console.log(`                at-point=${clicks.next.hit} (${clicks.next.hitTag}) `
  + `label=${JSON.stringify(clicks.next.label)}`)
console.log(`                ledger before=${JSON.stringify(clicks.nextBefore)} `
  + `after=${JSON.stringify(clicks.next.after)}`)
console.log(`  convert       at-point=${clicks.convert.hit} (${clicks.convert.hitTag}) `
  + `form before=${clicks.convert.formBefore} after=${clicks.convert.formAfter}`)
console.log('\n  WHAT MUST REMAIN (at 1440)')
{
  const r = rows.find((x) => x.width === 1440)
  console.log(`  cards: ${r.cards.join(' ')}`)
  console.log(`  counts: ${Object.entries(r.counts).map(([k, v]) => `${k}=${v}`).join('  ')}`)
  console.log(`  Summary/Notes band offset inside the panel: ${r.topRowWithinPanel}px`)
}
console.log(`\n  written: .verify/walk2/${LABEL}.json and ${LABEL}-<width>.png`)
