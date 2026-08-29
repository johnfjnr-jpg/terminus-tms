// Which CSS rules match nothing. Round 40, on the business's instruction.
//
// ── WHY THE CLASS SCAN IS NOT ENOUGH ───────────────────────────────────────
//
// scripts/tests/class-rules.test.mjs asks "does this class name have a rule",
// which catches a class the stylesheet never mentions. It cannot catch the
// opposite: a rule that EXISTS and can never match.
//
// The instance. `.pg-margin.pg-margin-override` was written for Round 40 Phase
// 2's read-only margin cells. Phase 3 made them inputs carrying
// `pg-margin-input pg-margin-override`, so the two classes in that selector
// never co-occur on any element. The rule is defined, so the scan passes, and
// it is dead, so the override never shows. **A COMPOUND SELECTOR WHOSE PARTS DO
// NOT MEET IS DEFINED AND DEAD.**
//
// ── WHAT THIS CAN AND CANNOT CONCLUDE, STATED RATHER THAN IMPLIED ─────────
//
// "Matched nothing during this run" is not "dead". A rule for a state this run
// never visited is alive and unreached, which is why the output is a CANDIDATE
// LIST for a person to read rather than a pass/fail gate, and why it walks
// several screens and several branches rather than one.
//
// The candidates worth acting on first are compound selectors whose parts each
// match something on their own: that is the shape above, and it is reported
// separately because it is the one that cannot be explained by an unvisited
// state.
// ── PREREQUISITE, NAMED RATHER THAN ASSUMED ────────────────────────────────
//
// puppeteer is not a dependency of this repository and deliberately is not: it
// pulls a browser download, and CI runs `npm ci` on every push. Every browser
// probe in this project has been run from a scratch install for the same
// reason. So this states where to get it instead of failing with a module
// resolution stack trace, which reads as a broken script rather than a missing
// tool.
//
//   npm i puppeteer --prefix /tmp/tms-probe
//   NODE_PATH=/tmp/tms-probe/node_modules node scripts/probe-dead-selectors.mjs
let puppeteer
try {
  puppeteer = (await import(process.env.PUPPETEER_PATH ?? 'puppeteer')).default
} catch {
  console.error('puppeteer is not available, and it is not a dependency of this repository.')
  console.error('  npm i puppeteer --prefix /tmp/tms-probe')
  console.error('  PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer node scripts/probe-dead-selectors.mjs')
  process.exit(1)
}
import { readFileSync } from 'fs'

const session = JSON.parse(readFileSync(new URL('../session-ref.json', import.meta.url).pathname, 'utf8'))
const OPP = process.env.PROBE_OPP ?? '5e5ca23d-bfe5-4383-828f-726aeaeb6146'
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1300 })
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
await page.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(session))
await page.reload({ waitUntil: 'networkidle0' })

// CALIBRATION, injected before anything is measured: a rule that cannot match,
// and one that certainly does. If the dead one is not reported, the probe is
// not measuring; if the live one IS reported, it is reporting noise.
await page.evaluate(() => {
  const s = document.createElement('style')
  s.textContent = '.calibration-cannot-match-xyz { color: red } body { outline: 0 }'
  document.head.appendChild(s)
})

const seen = new Map()   // selector -> matched ever
const record = async (why) => {
  const found = await page.evaluate(() => {
    const out = []
    for (const sheet of document.styleSheets) {
      let rules
      try { rules = sheet.cssRules } catch { continue }   // cross-origin
      const walk = (list) => {
        for (const r of list) {
          // NOT `if (r.cssRules)`. A CSSStyleRule in current Chrome HAS a
          // cssRules property, an EMPTY list, which is truthy - so a truthiness
          // check recursed into nothing and skipped every style rule, and the
          // probe reported zero selectors while the sheet held 570. Length, and
          // record this rule's own selector before recursing, since nested CSS
          // means a rule can have both.
          if (r.selectorText) {
          for (const sel of r.selectorText.split(',')) {
            const s = sel.trim()
            if (!s || /::?(before|after|placeholder|selection|-webkit|marker|backdrop|first-line)/.test(s)) continue
            let n = 0
            try { n = document.querySelectorAll(s.replace(/:(hover|focus|active|focus-visible|focus-within|disabled|checked|target)\b/g, '')).length } catch { continue }
            out.push([s, n])
          }
          }
          if (r.cssRules && r.cssRules.length) walk(r.cssRules)
        }
      }
      walk(rules)
    }
    return out
  })
  for (const [sel, n] of found) seen.set(sel, (seen.get(sel) ?? 0) + n)
  process.stdout.write(`  visited ${why}: ${found.length} selectors evaluated\n`)
}

await record('dashboard')

for (const [nav, why] of [['leads', 'Leads'], ['contacts', 'Contacts'], ['accounts', 'Accounts'], ['test-beds', 'Test Beds'], ['opportunities', 'Opportunities']]) {
  const ok = await page.evaluate((n) => { const el = document.querySelector(`[data-nav="${n}"]`); if (el) { el.click(); return true } return false }, nav)
  if (ok) { await new Promise((r) => setTimeout(r, 700)); await record(why) }
}

await page.evaluate((id) => navigate('opportunity-detail', id), OPP)
await page.waitForFunction(() => document.getElementById('opp-tab-commercial') !== null)
await record('Opportunity detail')
for (const t of ['reference', 'commercial', 'assessment']) {
  const ok = await page.evaluate((k) => { const el = document.querySelector(`[data-opp-tab="${k}"]`); if (el) { el.click(); return true } return false }, t)
  if (ok) { await new Promise((r) => setTimeout(r, 600)); await record('Opportunity ' + t) }
}
// The branches that render extra markup on Commercials.
await page.evaluate(() => document.querySelector('[data-opp-tab="commercial"]')?.click())
await new Promise((r) => setTimeout(r, 500))
await page.evaluate(() => document.getElementById('btn-toggle-detail')?.click())
await new Promise((r) => setTimeout(r, 300))
await record('Commercials, detail open')
for (const opt of ['Terminus Contractor - Lump Sum', 'Terminus Contractor - Per Unit']) {
  await page.evaluate((v) => {
    const el = document.getElementById('deal-installResp')
    if (el) { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })) }
  }, opt)
  await new Promise((r) => setTimeout(r, 400))
  await record('installResp ' + opt)
}

const dead = [...seen.entries()].filter(([, n]) => n === 0).map(([s]) => s).sort()
const alive = new Set([...seen.entries()].filter(([, n]) => n > 0).map(([s]) => s))

// The sharp subset: a compound selector every part of which matches on its own.
const parts = (s) => (s.match(/\.[A-Za-z_][A-Za-z0-9_-]*/g) ?? [])
const partsAllAlive = dead.filter((s) => {
  const p = parts(s)
  return p.length >= 2 && p.every((c) => alive.has(c) || [...alive].some((a) => a.includes(c)))
})

console.log(`\n  selectors seen: ${seen.size}   matched nothing in this run: ${dead.length}`)
const calib = dead.includes('.calibration-cannot-match-xyz')
console.log(`  CALIBRATION  dead rule reported: ${calib}   live rule (body) reported dead: ${dead.includes('body')}`)
if (!calib) { console.error('  the probe did not report its own dead rule; it is not measuring.'); process.exit(1) }

console.log('\n  COMPOUND SELECTORS WHOSE PARTS ALL MATCH SEPARATELY (the .pg-margin shape):')
for (const s of partsAllAlive) if (!s.includes('calibration')) console.log('    ' + s)

console.log(`\n  every selector matching nothing (${dead.length}), for reading:`)
for (const s of dead) if (!s.includes('calibration')) console.log('    ' + s)
await browser.close()
